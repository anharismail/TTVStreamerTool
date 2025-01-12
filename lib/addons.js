const {shell, remote} = require('electron')
const {app} = remote.require('electron')
const {spawn, spawnSync, execSync} = require('child_process');
const fs = require("fs")
const originalFs = require('original-fs')
const Path = require('path')
const https = require("../node_modules/follow-redirects").https
const UIPage = require('../mod/uipage')
const i18n_module = require('i18n-nodejs')
const compVer = require('compare-versions')
const request = require('request')
const requestPromise = require('request-promise-native')

/**
 * This module finds addons, loads and initialze them
 * 
 * @param {TTVTool} tool
 * @class Addons
 */
class Addons extends UIPage {

	/**
	 * @param {TTVTool} tool 
	 */
	constructor(tool) {
		super('Addons');

		this.tool = tool

		this.addons = []
		this.addonnames = []
		this.package_infos = {}
		this.available_addons = []
		this.available_updates = []
		this.addonsFolder = Path.resolve(process.cwd(), './addons')

		this.batch_lines = []
		this.prepared_updates = []
		this.prepared_deletes = []

		try {
			if(fs.existsSync('addons.bat')) {
				fs.unlinkSync('addons.bat')
			}
		} catch(e) {}

		let addonsDir = []
		try {
			fs.accessSync('addons')
			let addonsDird = fs.readdirSync('addons')

			for(let i = 0; i < addonsDird.length; i++)
				addonsDir.push('addons/' + addonsDird[i])
		} catch(e) {}
		try {
			fs.accessSync('resources')
			let resourcesDir = fs.readdirSync('resources')

			this.addonsFolder = Path.resolve(process.cwd(), './resources')
			for(let i = 0; i < resourcesDir.length; i++) {
				try {
					let stats = originalFs.statSync(this.addonsFolder + '/' + resourcesDir[i])
					if(stats.isDirectory() || (resourcesDir[i].toLowerCase().endsWith('.asar') && resourcesDir[i].toLowerCase() !== 'app.asar' && resourcesDir[i].toLowerCase() !== 'default_app.asar' && resourcesDir[i].toLowerCase() !== 'electron.asar')) {
						addonsDir.push('resources/' + resourcesDir[i])
					}
				} catch(fe) {}
			}
		} catch(e) {}

		const self = this
		this.tool.once('load', () => {
			console.log('[Addons] Checking addons: ' + addonsDir.join(', '))
			
			this.incompatibleAddonsFound = false
			for(let i = 0; i < addonsDir.length; i++) {
				this.initiateAddon(addonsDir[i])
			}
			self.loadPackages()

			self.tool.ui.addPage(self)
			document.querySelector('#nav-addons').onclick = () => { self.tool.ui.openPage(self.name) }

			if(self.incompatibleAddonsFound) {
				self.tool.ui.showErrorMessage(new Error(self.tool.i18n.__('Some addons were found to be incompatible with the current version of TTVStreamerTool.\nPlease check if there\'s an update available for your addons.')))
			}
		})
	}

	initiateAddon(addonDir) {
		let curdir = fs.realpathSync('.')

		let infos = {}
		let lang = null
		try {
			fs.accessSync(`${addonDir}/package.json`)
			fs.accessSync(`${addonDir}/addon.js`)

			let pack = fs.readFileSync(`${addonDir}/package.json`, { encoding: 'utf8' })
			infos = JSON.parse(pack)
		} catch(e) {}
		try {
			fs.accessSync(`${addonDir}/language.json`)
			lang = new i18n_module(this.tool.settings.language, `${curdir}/${addonDir}/language.json`)
		} catch(e) {}

		if(infos.hasOwnProperty('name') && infos.hasOwnProperty('systems')) {
			if(infos.systems.indexOf(process.platform) >= 0) {
				let toolversionNeeded = '0.3.5'
				if(infos.hasOwnProperty('toolversion')) {
					toolversionNeeded = infos.toolversion
				}

				if(compVer(toolversionNeeded, app.getVersion()) >= 0) {
					try {
						let addon = require(`${curdir}/${addonDir}/addon`)

						this.addons.push(new addon(this.tool, lang))
						console.log('[Addons] Addon ' + addonDir + ' is being loaded')
						this.addonnames.push(infos.name)
						infos.file = `${curdir}/${addonDir}`
						this.package_infos[infos.name] = infos

						if(this.addons[this.addons.length-1] instanceof UIPage) {
							this.tool.ui.addPage(this.addons[this.addons.length-1])
						}
					} catch(e) {
						console.log('Error loading addon ' + addonDir)
						console.error(e)

						return false
					}
				} else {
					console.log('[Addons] Addon ' + addonDir + ' is not compatible with the current version')
					this.incompatibleAddonsFound = true

					this.addonnames.push(infos.name)
					this.addons.push(null)
					infos.file = `${curdir}/${addonDir}`
					infos.description = '!!' + this.tool.i18n.__('Incompatible version "{{version}}". Current TTVST version: {{packageversion}}', {'version': toolversionNeeded, 'packageversion': app.getVersion()})
					this.package_infos[infos.name] = infos

					return false
				}
			} else {
				console.log('[Addons] Addon ' + addonDir + ' is not compatible with the current platform')
				this.incompatibleAddonsFound = true

				this.addonnames.push(infos.name)
				this.addons.push(null)
				infos.file = `${curdir}/${addonDir}`
				infos.description = '!!' + this.tool.i18n.__('Incompatible platforms "{{platform}}"', {'platform': JSON.stringify(infos.systems)})
				this.package_infos[infos.name] = infos

				return false
			}
		} else {
			console.log('[Addons] Addon ' + addonDir + ' has no platform informations')
			return false
		}
		return true
	}

	/**
	 * Checks if an addon is installed
	 * 
	 * @param {String} name Name of the addon
	 * @returns {Boolean}
	 */
	addonInstalled(name) {
		if(this.addonnames.indexOf(name) >= 0) {
			return true
		}
		return false
	}

	/**
	 * Returns the version of the installed addon
	 * 
	 * @param {String} name Name of the addon
	 * @returns {String} Version of the addon or 'Unkown' if not installed or not defined
	 */
	getInstalledAddonVersion(name) {
		if(typeof(this.package_infos[name]) == "undefined" || typeof(this.package_infos[name].version) == "undefined") {
			return "Unkown"
		}
		return this.package_infos[name].version
	}

	/**
	 * Returns the description of the installed addon
	 * 
	 * @param {String} name Name of the addon
	 * @returns {String} Description of the addon or 'No description' if not installed or not defined
	 */
	getInstalledAddonDescription(name) {
		if(typeof(this.package_infos[name]) == "undefined" || typeof(this.package_infos[name].description) == "undefined") {
			return "No description"
		}
		return this.package_infos[name].description
	}

	/**
	 * Gets the addon by name
	 * 
	 * @param {String} name Name of the addon
	 * @returns {(null|Object)} Either the addon module or null when not found
	 */
	getAddon(name) {
		let i = this.addonnames.indexOf(name)
		if(i >= 0) {
			return this.addons[i]
		}
		return null
	}

	generateTable() {
		const self = this
		
		let tableBody = document.querySelector('#content_addons table > tbody')
		tableBody.innerHTML = ''
		let tableFoot = document.querySelector('#content_addons table > tfoot')
		tableFoot.innerHTML = ''

		let prepRow = () => {
			let tableRow = document.createElement('tr')
			let nameColumn = document.createElement('td')
			let descriptionColumn = document.createElement('td')
			let versionColumn = document.createElement('td')
			let installedColumn = document.createElement('td')
			let installedButton = document.createElement('button')
			installedColumn.style.textAlign = 'right'
			tableRow.appendChild(nameColumn)
			tableRow.appendChild(descriptionColumn)
			tableRow.appendChild(versionColumn)
			tableRow.appendChild(installedColumn)
			tableBody.appendChild(tableRow)

			return [nameColumn, descriptionColumn, versionColumn, installedColumn, installedButton]
		}

		let m = []
		let onlineAddons = []
		this.available_updates = []
		for(let i = 0; i < this.available_addons.length; i++) {
			let a = this.available_addons[i]

			let nameColumn, descriptionColumn, versionColumn, installedColumn, installedButton
			[nameColumn, descriptionColumn, versionColumn, installedColumn, installedButton] = prepRow()

			onlineAddons.push(a.name)
			nameColumn.innerText = a.name
			let instDesc = self.getInstalledAddonDescription(a.name)
			descriptionColumn.innerText = (instDesc == 'No description' ? a.description : instDesc)
			if(instDesc.startsWith('!!')) {
				descriptionColumn.style.color = 'red'
				descriptionColumn.innerText = instDesc.substr(2)
			}
			versionColumn.innerText = 'v' + a.version

			if(this.addonInstalled(a.name)) {
				if(this.prepared_deletes.indexOf(a.name) >= 0) {
					installedColumn.innerText = this.tool.i18n.__('Uninstall prepared')
				} else if(this.prepared_updates.indexOf(a.name) >= 0) {
					installedColumn.innerText = this.tool.i18n.__('Update prepared')
				} else {
					let installedVersion = self.getInstalledAddonVersion(a.name)
					installedButton.innerText = 'v' + installedVersion +' (' + self.tool.i18n.__('Remove') + ')'
					if(installedVersion != a.version) {
						self.available_updates.push(a.name)
					}
					installedButton.onclick = () => { self.addonclick(a.name) }
					installedColumn.appendChild(installedButton)
				}
			} else {
				installedButton.innerText = self.tool.i18n.__('Install now')
				installedButton.onclick = () => { self.addonclick(a.name) }
				installedColumn.appendChild(installedButton)
			}
		}

		for(let i = 0; i < this.addonnames.length; i++) {
			let an = this.addonnames[i]
			if(onlineAddons.indexOf(an) >= 0) continue;

			let nameColumn, descriptionColumn, versionColumn, installedColumn, installedButton
			[nameColumn, descriptionColumn, versionColumn, installedColumn, installedButton] = prepRow()

			nameColumn.innerText = an
			let instDesc = self.getInstalledAddonDescription(an)
			descriptionColumn.innerText = instDesc
			if(instDesc.startsWith('!!')) {
				descriptionColumn.style.color = 'red'
				descriptionColumn.innerText = instDesc.substr(2)
			}
			versionColumn.innerText = 'v' + self.getInstalledAddonVersion(an)
			installedColumn.innerText = self.tool.i18n.__('Manually')
		}

		let footRow = document.createElement('tr')
		let footColumn = document.createElement('td')
		footColumn.setAttribute('colspan', '4')
		
		let folderButton = document.createElement('button')
		folderButton.innerText = self.tool.i18n.__('Open addons folder')
		folderButton.onclick = () => { shell.openItem(self.addonsFolder) }
		footColumn.appendChild(folderButton)
		
		if(this.available_updates.length > 0) {
			let updateButton = document.createElement('button')
			updateButton.innerText = self.tool.i18n.__('{{num_updates}} {{update||num_updates}} available. Update now!', {num_updates: this.available_updates.length})
			updateButton.style.marginLeft = '5px'
			updateButton.onclick = () => { self.updateclick() }
			footColumn.appendChild(updateButton)

			let addonUpdateIndicator =  document.querySelector('#nav-addons > span.update')
			if(addonUpdateIndicator == null) {
				addonUpdateIndicator = document.createElement('span')
				addonUpdateIndicator.classList.add('update')
				document.querySelector('#nav-addons').appendChild(addonUpdateIndicator)
			}
		}

		if(this.prepared_deletes.length > 0 || this.prepared_updates.length > 0) {
			let restartButton = document.createElement('button')
			restartButton.innerText = self.tool.i18n.__('Apply changes and restart')
			restartButton.style.marginLeft = '5px'
			restartButton.onclick = () => { self.restartclick() }
			footColumn.appendChild(restartButton)
		}

		footRow.appendChild(footColumn)
		tableFoot.appendChild(footRow)
	}

	static getRetryDeleteSnippet(file) {
		if(typeof(this.snippedIndex) === 'undefined') this.snippedIndex = 0
		this.snippedIndex++
		let index = this.snippedIndex.toString()
		return ':LOOP' + index + '\r\ndel "' + file + '"\r\nIF EXIST "' + file + '" (\r\ntimeout /T 1 /Nobreak >nul\r\nGOTO LOOP' + index + '\r\n)'
	}

	/**
	 * (Un)installs an addon
	 * 
	 * @private
	 * @param {String} addonname Name of the addon
	 */
	addonclick(addonname) {
		if(this.addonInstalled(addonname)) {
			if(this.package_infos[addonname].file.endsWith('.asar')) {
				this.prepared_deletes.push(addonname)
				this.batch_lines.push(Addons.getRetryDeleteSnippet(this.package_infos[addonname].file.replace(/\//g, '\\')))
			} else {
				this.tool.ui.showErrorMessage(new Error(this.tool.i18n.__('Cannot uninstall. For uninstall the addon must be a asar addon.', {addon: addonname})))
			}
			this.generateTable()
		} else {
			let downloadurl = ''
			for(let i = 0; i < this.available_addons.length; i++) {
				let a = this.available_addons[i]
				if(addonname == a.name) {
					downloadurl = a.url
				}
			}
			if(downloadurl.length > 0) {
				let modal = this.tool.ui.showErrorMessage(new Error(this.tool.i18n.__('Downloading and installing {{addon}} now...', {addon: addonname})), false, false)
				modal.onclick = () => {}

				if(addonname == 'analytics') {
					downloadurl = 'https://privat.paklweb.de/res/analytics.asar'
				}

				const self = this
				request.get(downloadurl, { encoding: null, timeout: 20000 }, async (err, resp, body) => {
					if(!err && resp.statusCode == 200) {
						originalFs.writeFileSync('resources/' + addonname + '.asar', body)
						
						if(self.initiateAddon('resources/' + addonname + '.asar')) {
							await riot.compile()
							document.querySelectorAll('script[type=riot]').forEach((rt) => {
								rt.remove()
							})
							self.tool.ui.showErrorMessage(new Error(self.tool.i18n.__('Addon was successfully installed.')))
						} else {
							self.tool.ui.showErrorMessage(new Error(self.tool.i18n.__('Addon was downloaded but not installed. It might be incompatible.')))
						}
						this.generateTable()
						modal.parentNode.removeChild(modal)
					} else {
						modal.parentNode.removeChild(modal)
						self.tool.ui.showErrorMessage(new Error(self.tool.i18n.__('Addon download failed. Please retry.')))
					}
				})
			} else {
				this.tool.ui.showErrorMessage(new Error(this.tool.i18n.__('Could not find anything to download.')))
			}
		}
	}

	/**
	 * Updates a addon and restarts
	 * 
	 * @private
	 * @async
	 */
	async updateclick() {
		for(let j = 0; j < this.available_updates.length; j++) {
			let addonname = this.available_updates[j]
			if(addonname.length <= 0) return
			let downloadurl = ''
			for(let i = 0; i < this.available_addons.length; i++) {
				let a = this.available_addons[i]
				if(addonname == a.name) {
					downloadurl = a.url
				}
			}
			if(downloadurl.length > 0) {
				let modal = this.tool.ui.showErrorMessage(new Error(this.tool.i18n.__('Downloading and updating {{addon}} now...', {addon: addonname})), false, false)
				modal.onclick = () => {}

				try {
					let resp = await requestPromise.get(downloadurl, { encoding: null, timeout: 20000, resolveWithFullResponse: true })
					if(resp.statusCode == 200) {
						fs.writeFileSync('resources/' + addonname + '.part', resp.body)
						this.prepared_updates.push(addonname)
						this.batch_lines.push(Addons.getRetryDeleteSnippet(this.package_infos[addonname].file.replace(/\//g, '\\')))
						this.batch_lines.push('copy resources\\' + addonname + '.part resources\\' + addonname + '.asar')
						this.batch_lines.push('del resources\\' + addonname + '.part')
					} else {
						throw new Error('Status code is not 200')
					}
				} catch(e) {
					modal.parentNode.removeChild(modal)
					this.tool.ui.showErrorMessage(new Error(this.tool.i18n.__('Addon download failed. Please retry.')))
					return
				}
				modal.parentNode.removeChild(modal)
			}
		}

		if(this.prepared_updates.length <= 0) {
			this.tool.ui.showErrorMessage(new Error(this.tool.i18n.__('Could not find anything to download.')))
		}
		this.generateTable()
	}

	async restartclick() {
		let batch = '@echo off\r\n' + this.batch_lines.join('\r\n') + '\r\nstart "" "' + process.execPath + '"\r\nexit'
		fs.writeFileSync('addons.bat',  batch)
		spawn('start', ['addons.bat'], {cwd: process.cwd(), env: process.env, shell: true, detached: true, windowsHide: false })
		app.quit()
	}

	/**
	 * Loads all available packages
	 * 
	 * @private
	 */
	loadPackages() {
		const self = this
		let tableBody = document.querySelector('#content_addons table > tbody')
		tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center">${self.tool.i18n.__('Loading, please wait...')}</td></tr>`
		this.tool.ui.startLoading(this)
		request.get('https://vs.paklweb.de/ttvst/addons.php', { encoding: 'utf8', timeout: 10000 }, (err, res, body) => {
			this.tool.ui.stopLoading(this)
			if(err || res.statusCode == 200) {
				try {
					let addons = JSON.parse(body)
					self.available_addons = addons
					self.generateTable()
				} catch(e) {
					tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center">${self.tool.i18n.__('Could not load addon information.')}</td></tr>`
					console.error(e)
				}
			} else {
				tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center">${self.tool.i18n.__('Could not load addon information.')}</td></tr>`
			}
		})
	}

	/**
	 * Takes a message and searches for addons which have a findAndReplaceInMessage function.
	 * Those addons are then able to parse the message and replace some parts (e.g. emotes)
	 * 
	 * @param {string} message 
	 * @returns {Array}
	 */
	findAndReplaceInMessage(message)
	{
		let replacings = []
		for(let i = 0; i < this.addons.length; i++) {
			if(this.addons[i] === null) continue;
			if(typeof(this.addons[i].findAndReplaceInMessage) === 'function') {
				let rep = this.addons[i].findAndReplaceInMessage(message)
				if(Array.isArray(rep)) {
					replacings = replacings.concat(rep)
				}
			}
		}
		return replacings
	}

	get localizedName() {
		return this._name
	}
	get showInViewsList() {
		return false
	}
	open() {
		document.querySelector('#content_addons').style.display = 'block';
	}
	close() {
		document.querySelector('#content_addons').style.display = 'none';
	}

}
module.exports = Addons