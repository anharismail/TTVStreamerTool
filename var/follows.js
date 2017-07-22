"use strict"

const EventEmitter = require('events')

/**
 * This module polls channel followers on a regular basis and emits events on changes
 * 
 * @class Follows
 * @extends {EventEmitter}
 * @param {TTVTool} tool
 * @fires Follows#follow
 */
class Follows extends EventEmitter {

	constructor(tool) {
		super()
		this.tool = tool

		this.latestFollow = 0
		this.timer = null
		
		const self = this
		this.tool.cockpit.on('channelopen', () => {
			self.fetchData()
		})
		this.tool.cockpit.on('channelleft', () => {
			self.latestFollow = 0
			clearTimeout(self.timer)
		})
	}

	/**
	 * Shortcut to the twitch api object
	 * 
	 * @readonly
	 * @private
	 */
	get api() {
		return this.tool.twitchapi
	}

	/**
	 * Shortcut to the cockpit
	 * 
	 * @readonly
	 * @private
	 */
	get cockpit() {
		return this.tool.cockpit
	}

	/**
	 * Fetches data every 30 seconds. Do not call this manually.
	 * 
	 * @async
	 * @private
	 */
	fetchData() {
		const self = this
		if(this.cockpit.openChannelId.length <= 0) return
		
		this.api.getChannelFollowers(this.cockpit.openChannelId, { direction: 'desc' }, (res, err) => {
			if(res != null && res.hasOwnProperty('follows')) {
				let follows = res.follows
				follows.sort(function(a, b){ return new Date(a.created_at).getTime() - new Date(b.created_at).getTime() })
				for(let i = 0; i < follows.length; i++) {
					let f = follows[i]
					if(new Date(f.created_at).getTime() > self.latestFollow) {
						let dn = f.user.display_name
						if(!self.tool.settings.showLocalizedNames && !dn.match(/^[a-z0-9_\-]+$/i))
							dn = f.user.name
						let usr = {
							user: f.user.name,
							name: dn,
							color: self.tool.chat.userselement._tag.getUserColor(f.user.name)
						}

						/**
						 * Fires when a new follower appears in the list
						 * @event Follows#follow
						 * @param {Follows~userObject} user The user with username, display name and color
						 * @param {Object} raw The raw follow object from the api
						 */
						self.emit('follow', usr, f)
						self.latestFollow = new Date(f.created_at).getTime()
					}
				}
			} else if(err != null) {
				if(err.hasOwnProperty('message')) err.message += '\n' + self.tool.i18n.__('Click here to dismiss this message')
				self.tool.ui.showErrorMessage(err, true)
			}

			self.timer = setTimeout(() => { self.fetchData() }, (30000 - (new Date().getTime() % 30000)))
		})
	}

}

/**
 * An abstraction of the {@link Chat~userObject} but with less properties
 * @typedef {Object} Follows~userObject
 * @property {String} user Twitch user name
 * @property {String} name Twitch display name
 * @property {String} color Hex color string prepended by a #
 */

module.exports = Follows