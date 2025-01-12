<hotkey>
	<table>
		<tbody>
			<tr>
				<td><input type="text" ref="hotkeyaccelerator" class="hotkeyaccelerator" value={ hotkeyaccelerator } onkeyup={ accelerator_up } onkeydown={ accelerator_down }></td>
				<td><input type="text" ref="hotkeycommand" class="hotkeycommand" value={ hotkeycommand } onkeydown={ changes }></td>
			</tr>
		</tbody>
	</table>

	<style>
		hotkey > table {
			width: 100%;
		}
		hotkey > table td:first-child {
			width: 20%;
		}
		hotkey > table input {
			box-sizing: border-box;
			width: 100%;
		}
	</style>

	<script>
		export default {
			onBeforeMount() {
				this.hotkeyaccelerator = this.props.hotkey.accelerator
				this.hotkeycommand = this.props.hotkey.cmd
				this.parent = this.props.parent
				this.keyCodes = {
					'8' : 'Backspace',
					'9' : "Tab",
					'13' : "Enter",
					'16' : "Shift",
					'17' : "Ctrl",
					'18' : "Alt",
					'27' : "Escape",
					'32' : "Space",
					'33' : "PageUp",
					'34' : "PageDown",
					'35' : "End",
					'36' : "Home",
					'37' : "Left",
					'38' : "Up",
					'39' : "Right",
					'40' : "Down",
					'44' : "PrintScreen",
					'45' : "Insert",
					'46' : "Delete",
					'48' : "0",
					'49' : "1",
					'50' : "2",
					'51' : "3",
					'52' : "4",
					'53' : "5",
					'54' : "6",
					'55' : "7",
					'56' : "8",
					'57' : "9",
					'58' : ":",
					'59' : ";",
					'60' : "<",
					'61' : "=",
					'63' : "ß",
					'64' : "@",
					'65' : "A",
					'66' : "B",
					'67' : "C",
					'68' : "D",
					'69' : "E",
					'70' : "F",
					'71' : "G",
					'72' : "H",
					'73' : "I",
					'74' : "J",
					'75' : "K",
					'76' : "L",
					'77' : "M",
					'78' : "N",
					'79' : "O",
					'80' : "P",
					'81' : "Q",
					'82' : "R",
					'83' : "S",
					'84' : "T",
					'85' : "U",
					'86' : "V",
					'87' : "W",
					'88' : "X",
					'89' : "Y",
					'90' : "Z",
					'91' : "Super",
					'92' : "Super",
					'93' : "Option",
					'112' : "F1",
					'113' : "F2",
					'114' : "F3",
					'115' : "F4",
					'116' : "F5",
					'117' : "F6",
					'118' : "F7",
					'119' : "F8",
					'120' : "F9",
					'121' : "F10",
					'122' : "F11",
					'123' : "F12",
					'124' : "F13",
					'125' : "F14",
					'126' : "F15",
					'127' : "F16",
					'128' : "F17",
					'129' : "F18",
					'130' : "F19",
					'131' : "F20",
					'132' : "F21",
					'133' : "F22",
					'134' : "F23",
					'135' : "F24",
					'160' : "^",
					'161' : '!',
					'163' : "#",
					'164' : '$',
					'170' : '*',
					'171' : "+",
					'173' : "-",
					'174' : "VolumeDown",
					'175' : "VolumeUp",
					'176' : "MediaNextTrack",
					'177' : "MediaPreviousTrack",
					'178' : "MediaStop",
					'179' : "MediaPlayPause",
					'181' : "VolumeMute",
					'182' : "VolumeDown",
					'183' : "VolumeUp",
					'186' : ";",
					'187' : "=",
					'188' : ",",
					'189' : "-",
					'190' : ".",
					'191' : "/",
					'193' : "?",
					'219' : "(",
					'220' : "\\",
					'221' : ")",
					'222' : "'",
					'223' : "`",
					'224' : "Command",
					'225' : "AltGr"
				}
				this.accelerator = []
			},
			onMounted() {
				this.refs = {
					hotkeyaccelerator: this.$('[ref=hotkeyaccelerator]'),
					hotkeycommand: this.$('[ref=hotkeycommand]')
				}

				this.refs.hotkeyaccelerator.setAttribute('placeholder', Tool.i18n.__('Enter Hotkey'))
				this.refs.hotkeycommand.setAttribute('placeholder', Tool.i18n.__('Enter command that is sent to overlays'))

				const self = this
				this.refs.hotkeycommand.onkeydown = () => { self.changes() }
			},

			onBeforeUpdate() {
				this.hotkeyaccelerator = this.props.hotkey.accelerator
				this.hotkeycommand = this.props.hotkey.cmd
			},

			accelerator_down(e) {
				e.preventDefault()

				if(this.keyCodes.hasOwnProperty(e.keyCode.toString())) {
					if(this.accelerator.indexOf('+' + this.keyCodes[e.keyCode.toString()]) < 0) {
						this.accelerator.push('+' + this.keyCodes[e.keyCode.toString()])
					}
				}
				if(this.accelerator.length > 0) {
					this.props.hotkey.accelerator = this.accelerator.join('').substr(1)
					this.update()
					this.changes()
				}
			},
			accelerator_up(e) {
				e.preventDefault()

				if(this.keyCodes.hasOwnProperty(e.keyCode.toString())) {
					let s = '+' + this.keyCodes[e.keyCode.toString()]
					let i = this.accelerator.indexOf('+' + this.keyCodes[e.keyCode.toString()])
					if(i >= 0) {
						this.accelerator.splice(i, 1)
					}
				}
			},
			changes() {
				if(typeof(this.parent) !== 'undefined' && this.parent !== null) {
					this.parent.changes()
				}
			}
		}
	</script>
</hotkey>