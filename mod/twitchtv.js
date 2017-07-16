"use strict"
const https = require('https')
const url = require('url')
const zlib = require('zlib')

/**
 * This module manages requests to the twitch api in a asynchonos manner
 * 
 * @class TwitchTv
 * @param {Object} options Options for the TwitchTv object
 * @param {String} [options.clientid] The client id of the twitch api app
 * @param {String} [options.redirecturi] The redirect uri of the twitch api app
 * @param {Array} [options.scope] An array of the permission scopes you might need
 */
class TwitchTv {

	constructor(options) {
		/**
		 * The twitch api app client id that is necessary for request to the twitch api.
		 * @member {String}
		 */
		this.clientid = ''
		/**
		 * The redirect uri that ist set in the app settings.
		 * @member {String}
		 */
		this.redirecturi = ''
		/**
		 * An array with the required permission scopes.
		 * @member {Array}
		 */
		this.scope = []
		/**
		 * You know exactly what this is. Don't touch it!
		 * @private
		 * @member {String}
		 */
		this.token = ''
		/**
		 * User id of the logged in user.
		 * @member {String}
		 */
		this.userid = ''
		/**
		 * An object with all twitch user information. More information in the {@link https://dev.twitch.tv/docs/v5/reference/users/#get-user|twitch api documentation}.
		 * @member {(null | Object)}
		 */
		this.userobj = null
		/**
		 * The channel id of the logged in user. Until now it's the same as the user id but it might change.
		 * @member {String}
		 */
		this.channelid = ''
		/**
		 * An object with all twitch channel information. More information in the {@link https://dev.twitch.tv/docs/v5/reference/channels/#get-channel|twitch api documentation}.
		 * @member {(null | Object)}
		 */
		this.channelobj = null

		this.validstates = []

		if(typeof(options.clientid) == 'string') this.clientid = options.clientid
		if(typeof(options.redirecturi) == 'string') this.redirecturi = options.redirecturi
		if(typeof(options.scope) == 'object') this.scope = options.scope

		this.token = window.localStorage.getItem('tw_auth_token')
		if(this.token == null) this.token = ''
	}

	/**
	 * Returns a complete URL for the grant flow authentication and creates a state.
	 * 
	 * @returns {String}
	 */
	getAuthImplicitGrantFlowUrl() {
		var state = Math.floor(Date.now() / 1000).toString(16)
		this.validstates.push(state)

		return 'https://api.twitch.tv/kraken/oauth2/authorize' +
				'?response_type=token' +
				'&client_id=' + this.clientid +
				'&redirect_uri=' + encodeURIComponent(this.redirecturi) +
				'&scope=' + this.scope.join('+') +
				'&state=' + state +
				'&force_verify=true'
	}

	/**
	 * Verifys if this returned state is one of the valid states and removes it from the local list.
	 * 
	 * @param {String} state The state that is returned by the OAuth auth flow
	 * @returns {Boolean}
	 */
	verifyState(state) {
		var i = this.validstates.indexOf(state)
		if(i >= 0) {
			this.validstates.splice(i, 1)
			return true
		}

		return false
	}

	/**
	 * Fills the user token and saves it in the localStorage.
	 * 
	 * @param {String} token The token that is returned by the OAuth2 auth flow
	 */
	setAuthToken(token) {
		if(typeof(token) != 'string') token = ''
		this.token = token
		window.localStorage.setItem('tw_auth_token', token)
	}

	/**
	 * Returns the twitch user auth token. Used for login in twitch irc or api requests for user related information.
	 * 
	 * @returns {String}
	 */
	getAuthToken() {
		return this.token
	}

	/**
	 * Returns true if user is logged in.
	 * 
	 * @returns {Boolean}
	 */
	isLoggedIn() {
		return (this.token.length > 0)
	}

	/**
	 * Prepares and executes a request to the twitch api and parses the response
	 * 
	 * @async
	 * @param {String} uri The URI to the api endpoint. Only the path is required, the host api.twitch.tv is prepended when the uri does not start with https://
	 * @param {Object} query An object with all request parameters. Is being encoded for the uri. Must be passed but can be empty.
	 * @param {Boolean} authNeeded Is user authorization required for this request. Oauth token is then passed on the request.
	 * @param {Object} [postdata={}] Optional post data. If there are properties in this object authNeeded is set to true and request method is set to put. Post data is serialized to a JSON string.
	 * @param {TwitchTv~requestCallback} callback The callback that is called after response was processed. If this is not passed no request is being done!
	 * @example
	 * twitchtv.requestAPI(
	 *     // uri
	 *     '/kraken/users/44322889/follows/channels',
	 * 
	 *     // query
	 *     {
	 *         limit: 100,
	 *         direction: 'desc'
	 *     },
	 * 
	 *     // authNeeded
	 *     false,
	 * 
	 *     // callback
	 *     (data, err) => {
	 *         if(err === null) {
	 *             // Do something with the data
	 *         }
	 *     }
	 * )
	 */
	requestAPI(uri, query, authNeeded, postdata, callback) {
		const self = this
		if(typeof(authNeeded) != 'boolean') authNeeded = false
		if(typeof(query) != 'object' || query == null) query = {}

		if(typeof(postdata) == 'function') {
			callback = postdata
			postdata = {}
		}
		if(typeof(uri) != 'string' || typeof(callback) != 'function') return

		if(Object.keys(postdata).length > 0) authNeeded = true

		let querystr = ''
		for(var key in query) {
			if(query.hasOwnProperty(key)) {
				querystr += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(query[key])
			}
		}
		querystr = '?' + querystr.substr(1)
		if(querystr.length > 1) {
			uri += querystr
		}

		let headers = {
			'Accept': 'application/vnd.twitchtv.v5+json',
			'Client-ID': self.clientid,
			'Accept-Encoding': 'gzip'
		}
		if(authNeeded) {
			headers['Authorization'] = 'OAuth ' + self.token
		}
		var poststr = ''
		if(Object.keys(postdata).length > 0) {
			poststr = JSON.stringify(postdata)
			headers['Content-Type'] = 'application/json'
		}

		console.log(`Request for ${uri} started... authNeeded:${authNeeded}`)

		let overridehost = 'api.twitch.tv'
		if(uri.startsWith('https://')) {
			var parsedurl = url.parse(uri)
			overridehost = parsedurl.hostname
			uri = parsedurl.path
		}

		var req = https.request({
			'method': (Object.keys(postdata).length > 0 ? 'PUT' : 'GET'),
			'host': overridehost,
			'path': uri,
			'headers': headers
		}, (res) => {
			let gziped = false
			if(res.headers.hasOwnProperty('content-encoding') && res.headers['content-encoding'].toLowerCase() == 'gzip') {
				gziped = true
			}
			let rawData = ''
			let rawDataBuffer = Buffer.alloc(0)

			if(!gziped)
				res.setEncoding('utf8')
			
			res.on('data', (chunk) => {
				if(gziped) {
					rawDataBuffer = Buffer.concat([rawDataBuffer, chunk])
				} else {
					rawData += chunk
				}
			})
			res.on('end', () => {
				var error = null
				let parsed = null
				if(gziped) {
					rawData = zlib.gunzipSync(rawDataBuffer).toString('utf8')
				}
				try {
					parsed = JSON.parse(rawData)
				} catch(e) {
					console.log(rawData)
					error = e
				}
				if(res.statusCode != 200) {
					error = new Error(`API request failed for ${uri} with status code ${res.statusCode}`)
				} else {
					if(uri == '/kraken/user') {
						self.userobj = parsed
					} else if(uri == '/kraken/channels') {
						self.channelobj = parsed
					}
				}
				callback(parsed, error)
			})
		})
		req.on('error', (e) => {
			callback(null, new Error(`API request failed for ${uri} with message ${e.message}`))
		})
		if(poststr.length > 0)
			req.write(poststr)
		req.end()
	}

	/*********************************************
	 * Users
	 *********************************************/
	/**
	 * Gets a user by the passed userid or by the oauth token
	 * 
	 * @async
	 * @param {(String|Number)} [userid] The user id of the user you want to get. Usernames are not supported. Use {@link TwitchTv#getUserByName} to get the user by name.
	 * @param {TwitchTv~requestCallback} callback 
	 * @see {@link https://dev.twitch.tv/docs/v5/reference/users/#get-user}
	 */
	getUser(userid, callback) {
		if(typeof(userid) == 'function') {
			callback = userid
			userid = ''
		}
		if(typeof(callback) != 'function' || (typeof(userid) != 'string' && typeof(userid) != 'number')) return
		userid = userid.toString()
		if(userid.length == 0 && this.userobj != null) {
			callback(this.userobj, null)
		} else {
			this.requestAPI('/kraken/user' + (userid.length > 0 ? 's/' + userid : ''), null, !(userid.length > 0), callback)
		}
	}

	/**
	 * Gets user objects by name.
	 * 
	 * @async
	 * @param {String} username Username of the user you want to get. You can pass a comma seperated list (up to 100) to get multiple users at once. Display name is not supported.
	 * @param {TwitchTv~requestCallback} callback 
	 * @see {@link https://dev.twitch.tv/docs/v5/reference/users/#get-users}
	 */
	getUserByName(username, callback) {
		if(typeof(username) != 'string' || typeof(callback) != 'function') return
		username = username.toLowerCase()
		this.requestAPI('/kraken/users', { login: username }, false, callback)
	}

	/**
	 * Get the channels a user follows.
	 * 
	 * @async
	 * @param {(String|Number)} userid The user id of the user you want the follows of.
	 * @param {Object} options Options to control direction and sorting of the result
	 * @param {Number} [options.limit=25] Maximum number of most-recent objects to return. Maximum: 100.
	 * @param {Number} [options.offset=0] Object offset for pagination of results.
	 * @param {String} [options.direction='desc'] Sorting direction. Valid values: asc (oldes first), desc (newest first).
	 * @param {String} [options.sortby='created_at'] Sorting key. Valid values: created_at, last_broadcast, login.
	 * @param {TwitchTv~requestCallback} callback 
	 * @see {@link https://dev.twitch.tv/docs/v5/reference/users/#get-user-follows}
	 */
	getUserFollows(userid, options, callback) {
		if(typeof(callback) != 'function' || (typeof(userid) != 'string' && typeof(userid) != 'number')) return
		userid = userid.toString()
		if(userid.length == 0) {
			if(this.userid.length > 0) userid = this.userid
			else {
				const self = this
				this.getUser((res, err) => {
					if(res != null && res.hasOwnProperty('_id')) {
						self.userid = res._id
						self.getUserFollows('', options, callback)
					} else {
						callback(res, err)
					}
				})
				return
			}
		}
		var uri = '/kraken/users/' + userid + '/follows/channels'
		var opt = {}
		if(typeof(options) == 'object') {
			if(options.hasOwnProperty('limit') && typeof(options.limit) == 'number') opt.limit = options.limit
			if(options.hasOwnProperty('offset') && typeof(options.offset) == 'number') opt.offset = options.offset
			if(options.hasOwnProperty('direction') && (options.direction == 'asc' || options.direction == 'desc')) opt.direction = options.direction
			if(options.hasOwnProperty('sortby') && (options.sortby == 'created_at' || options.sortby == 'last_broadcast' || options.sortby == 'login')) opt.sortby = options.sortby
		}
		this.requestAPI(uri, opt, false, callback)
	}
	
	/*********************************************
	 * Channels
	 *********************************************/
	/**
	 * Gets a channel by the passed channelid or by the oauth token
	 * 
	 * @async
	 * @param {(String|Number)} [channelid] The channel id of the channel you want to get. Channel names are not supported.
	 * @param {TwitchTv~requestCallback} callback 
	 * @see {@link https://dev.twitch.tv/docs/v5/reference/channels/#get-channel}
	 */
	getChannel(channelid, callback) {
		if(typeof(channelid) == 'function') {
			callback = channelid
			channelid = ''
		}
		if(typeof(callback) != 'function' || (typeof(channelid) != 'string' && typeof(channelid) != 'number')) return
		channelid = channelid.toString()
		if(channelid.length == 0 && this.channelobj != null) {
			callback(this.channelobj, null)
		} else {
			this.requestAPI('/kraken/channel' + (channelid.length > 0 ? 's/' + channelid : ''), null, !(channelid.length > 0), callback)
		}
	}

	/**
	 * Updates some channel data
	 * 
	 * @async
	 * @param {(String|Number)} channelid The channel id of the channel you want to update. The logged in user must have permission for that or an http error 401 is returned.
	 * @param {Object} options Options that should be changed. At least one property is required or no request is made (and therefore no callback called).
	 * @param {String} [options.status] Description of the broadcaster's status, displayed as a title on the channel page.
	 * @param {String} [options.game] Name of game.
	 * @param {String} [options.delay] Channel delay, in seconds. This inserts a delay in the live feed. Only channel owner can change this.
	 * @param {Boolean} [options.channel_feed_enabled] If true, the channel's feed is turned on. Only channel owner can change this.
	 * @param {TwitchTv~requestCallback} callback 
	 * @see {@link https://dev.twitch.tv/docs/v5/reference/channels/#update-channel}
	 */
	updateChannel(channelid, options, callback) {
		if(typeof(callback) != 'function' || (typeof(channelid) != 'string' && typeof(channelid) != 'number')) return
		channelid = channelid.toString()

		var opt = {}
		if(typeof(options) == 'object') {
			if(options.hasOwnProperty('status') && typeof(options.status) == 'string') opt.status = options.status
			if(options.hasOwnProperty('game') && typeof(options.game) == 'string') opt.game = options.game
			if(options.hasOwnProperty('delay') && typeof(options.delay) == 'string') opt.delay = options.delay
			if(options.hasOwnProperty('channel_feed_enabled') && typeof(options.channel_feed_enabled) == 'boolean') opt.channel_feed_enabled = options.channel_feed_enabled
		}
		if(Object.keys(opt).length <= 0) return

		this.requestAPI('/kraken/channels/' + channelid, null, true, {channel: opt}, callback)
	}

	/**
	 * Gets users that follow the channel.
	 * 
	 * @async
	 * @param {(String|Number)} channelid Channel id of the channel you want the followers of.
	 * @param {Object} options Options to control direction of the result.
	 * @param {Number} [options.limit=25] Maximum number of objects to return. Maximum: 100.
	 * @param {Number} [options.offset=0] Object offset for pagination of results.
	 * @param {String} [options.cursor] Tells the server where to start fetching the next set of results, in a multi-page response.
	 * @param {String} [options.direction='desc'] Direction of sorting. Valid values: asc (oldest first), desc (newest first).
	 * @param {TwitchTv~requestCallback} callback 
	 * @see {@link https://dev.twitch.tv/docs/v5/reference/channels/#get-channel-followers}
	 */
	getChannelFollowers(channelid, options, callback) {
		if(typeof(callback) != 'function' || (typeof(channelid) != 'string' && typeof(channelid) != 'number')) return
		channelid = channelid.toString()
		if(channelid.length == 0) {
			if(this.channelid.length > 0) channelid = this.channelid
			else {
				const self = this
				this.getChannel((res, err) => {
					if(res != null && res.hasOwnProperty('_id')) {
						self.channelid = res._id
						self.getChannelFollowers('', options, callback)
					} else {
						callback(res, err)
					}
				})
				return
			}
		}
		var uri = '/kraken/channels/' + channelid + '/follows'
		var opt = {}
		if(typeof(options) == 'object') {
			if(options.hasOwnProperty('limit') && typeof(options.limit) == 'number') opt.limit = options.limit
			if(options.hasOwnProperty('offset') && typeof(options.offset) == 'number') opt.offset = options.offset
			if(options.hasOwnProperty('cursor') && typeof(options.cursor) == 'string') opt.cursor = options.cursor
			if(options.hasOwnProperty('direction') && (options.direction == 'asc' || options.direction == 'desc')) opt.direction = options.direction
		}
		this.requestAPI(uri, opt, false, callback)
	}

	/**
	 * Gets subscribers to the channel. Logged in user needs to have permission to view channel subscriber or you get a 401 error.
	 * 
	 * @async
	 * @param {(String|Number)} channelid Channel id of the channel you want the subscriber of.
	 * @param {Object} options Options to control direction of the result.
	 * @param {Number} [options.limit=25] Maximum number of objects to return. Maximum: 100.
	 * @param {Number} [options.offset=0] Object offset for pagination of results.
	 * @param {String} [options.direction='asc'] Direction of sorting. Valid values: asc (oldest first), desc (newest first).
	 * @param {TwitchTv~requestCallback} callback 
	 * @see {@link https://dev.twitch.tv/docs/v5/reference/channels/#get-channel-subscribers}
	 */
	getChannelSubscribers(channelid, options, callback) {
		if(typeof(callback) != 'function' || (typeof(channelid) != 'string' && typeof(channelid) != 'number')) return
		channelid = channelid.toString()
		if(channelid.length == 0) {
			if(this.channelid.length > 0) channelid = this.channelid
			else {
				const self = this
				this.getChannel((res, err) => {
					if(res != null && res.hasOwnProperty('_id')) {
						self.channelid = res._id
						self.getChannelSubscribers('', options, callback)
					} else {
						callback(res, err)
					}
				})
				return
			}
		}
		var uri = '/kraken/channels/' + channelid + '/subscriptions'
		var opt = {}
		if(typeof(options) == 'object') {
			if(options.hasOwnProperty('limit') && typeof(options.limit) == 'number') opt.limit = options.limit
			if(options.hasOwnProperty('offset') && typeof(options.offset) == 'number') opt.offset = options.offset
			if(options.hasOwnProperty('direction') && (options.direction == 'asc' || options.direction == 'desc')) opt.direction = options.direction
		}
		this.requestAPI(uri, opt, true, callback)
	}

	/*********************************************
	 * Chat
	 *********************************************/
	getChatBadgesByChannel(channelid, callback) {
		if(typeof(callback) != 'function' || (typeof(channelid) != 'string' && typeof(channelid) != 'number')) return
		channelid = channelid.toString()
		if(channelid.length > 0) {
			this.requestAPI('/kraken/chat/' + channelid + '/badges', null, false, callback)
		}
	}

	// Undocumented and slow but better
	getChatBadgeSetsByChannel(channelid, callback) {
		const self = this
		if(typeof(callback) != 'function' || (typeof(channelid) != 'string' && typeof(channelid) != 'number')) return
		channelid = channelid.toString()
		if(channelid.length > 0) {
			// Global badge settings are not available in the channel badge
			// sets so we need to load them first and overwrite them later
			this.getChatBadgeSetsByChannel('', (res, error) => {
				if(res != null && res.hasOwnProperty('badge_sets')) {
					self.requestAPI('https://badges.twitch.tv/v1/badges/channels/' + channelid + '/display', null, false, (res_channel, error) => {
						if(res_channel != null && res_channel.hasOwnProperty('badge_sets')) {
							// Overwrite global settings...
							for(var set in res_channel.badge_sets) {
								if(res_channel.badge_sets.hasOwnProperty(set)) {
									res.badge_sets[set] = res_channel.badge_sets[set]
								}
							}
							callback(res, error)
						} else {
							callback(res_channel, error)
						}
					})
				} else {
					callback(res, error)
				}
			})
		} else {
			this.requestAPI('https://badges.twitch.tv/v1/badges/global/display', null, false, callback)
		}
	}

	getChatEmoticonsBySet(emotesets, callback) {
		const self = this
		if(typeof(callback) != 'function' || typeof(emotesets) != 'string') return
			this.requestAPI('/kraken/chat/emoticon_images', {emotesets: emotesets}, false, callback)
	}
	
	/*********************************************
	 * Streams
	 *********************************************/
	getStreamByUser(channelid, options, callback) {
		if(typeof(callback) != 'function' || (typeof(channelid) != 'string' && typeof(channelid) != 'number')) return
		channelid = channelid.toString()
		if(channelid.length == 0) {
			if(this.channelid.length > 0) channelid = this.channelid
			else {
				const self = this
				this.getChannel((res, err) => {
					if(res != null && res.hasOwnProperty('_id')) {
						self.channelid = res._id
						self.getStreamByUser('', options, callback)
					} else {
						callback(res, err)
					}
				})
				return
			}
		}
		var uri = '/kraken/streams/' + channelid
		var opt = {}
		if(typeof(options) == 'object') {
			if(options.hasOwnProperty('stream_type') && (options.stream_type == 'live' || options.stream_type == 'playlist' || options.stream_type == 'all')) opt.stream_type = options.stream_type
		}
		this.requestAPI(uri, opt, false, callback)
	}

	/*********************************************
	 * Search
	 *********************************************/
	searchGames(query, options, callback) {
		if(typeof(callback) != 'function' || typeof(query) != 'string' || query.length < 3) return
		var uri = '/kraken/search/games'
		var opt = { query: query }
		if(typeof(options) == 'object') {
			if(options.hasOwnProperty('live') && (options.live == 'true' || options.live == 'false')) opt.live = options.live
		}
		this.requestAPI(uri, opt, false, callback)
	}

		

}
/**
 * @callback TwitchTv~requestCallback
 * @param {(null|Object)} data Has the parsed api response. Can have the api error response. Please check error for errors.
 * @param {(null|Error)} error Null if no error
 */

module.exports = TwitchTv