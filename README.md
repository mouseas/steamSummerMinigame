# Steam Summer 2015 Monster Minigame AutoScript #

## Purpose ##

This javascript automatically plays the 2015 Steam Summer minigame for you in a semi-optimal way.

It goes beyond the autoclicker scripts already out there. It will keep you in the lane where you'll make the most money, activate abilities as they are available and best apply, and possibly purchase upgrades and
powerups for you.

**DISCLAIMER:** This autoscript will *NOT* include an auto-clicker. Automatic clicking pushes into the area of cheating, and this script is not designed for cheating. It is designed for automating the process of collecting gold.

## Features ##

- Moves you to the lane most likely to give you gold, prioritized like so:
        1. The lane with a Treasure Minion or Boss
	2. The lane with the Miniboss with the lowest health
	3. The lane with a Spawner below 40% health
	4. The lane with a Creep below 10% health
	5. The lane with the Spawner with the lowest health
- Activates most reusable abilities, if they are purchased and cooled down:
	- Medics if your health is below 50%
	- Morale Booster, Napalm, and Cluster Bombs if the lane has a Spawner and 2-3 Creeps
	- Good Luck Charm as soon as possible
	- Tactical Nuke if the current Spawner is between 60% and 30% health
- Respawns you after 5 seconds (instead of 1 minute) if you die
- Disables certain abilities and items if facing a Boss (to try to maximize Raining Gold and Metal Detector benefits)

## Installation ##

### Tampermonkey ###

1. Open Tampermonkey's dashboard.
2. Click on the `Utilites` tab on the right.
3. Paste `https://raw.githubusercontent.com/mouseas/steamSummerMinigame/master/autoPlay.js` into the text area, and click `Import`.
4. When the editor has loaded, press `Install` (*NOT* `Process with Chrome`).

### Greasemonkey ###

1. Navigate to `https://raw.githubusercontent.com/mouseas/steamSummerMinigame/master/autoPlay.js`.
2. Right click on the page, and click `Save Page As`.
3. In the name text area at the top, remove the tailing `.js` and add `.user.js` to the end (this may be redundant in the future).
4. While Firefox is still open, open a File Manager of any sort, and navigate to the directory you saved the script.
5. Drag & drop the script file onto the Firefox window.
6. Press `Install`.

### Manual ###

#####Chrome#####
1. Open `autoPlay.js` in a text editor.
2. Select All, Copy.
3. Navigate to http://steamcommunity.com/minigame/ and join or start a game.
4. press `Cntrl+Shift+j`.
5. Paste into the javascript input, and hit `Enter`.
6. (Optional) To stop the script, type `window.clearTimeout(thingTimer);` into the console and hit Enter.

#####FireFox#####
1. Open `autoPlay.js` in a text editor.
2. Select All, Copy.
3. Navigate to http://steamcommunity.com/minigame/ and join or start a game.
4. press `Cntrl+Shift+k`.
5. Paste into the javascript input, and hit `Enter`.
6. (Optional) To stop the script, type `window.clearTimeout(thingTimer);` into the console and hit Enter.

#####Internet Explorer/Microsoft Edge#####
1. Open `autoPlay.js` in a text editor.
2. Select All, Copy.
3. Navigate to http://steamcommunity.com/minigame/ and join or start a game.
4. press `F12` and navigate to the `console` tab.
5. Paste into the javascript input, and hit `Enter`.
6. (Optional) To stop the script, type `window.clearTimeout(thingTimer);` into the console and hit Enter.

The game should now play itself, you should leave it running in the background. If you're not sure if it
is auto-playing, try changing lanes. If it jumps back almost immediately, it's working.

## TODO ##

- use abilities if available and a suitable target exists:
	 - Metal Detector if a spawner death is imminent (predicted in > 2 and < 7 seconds)
	 - Decrease Cooldowns right before using another long-cooldown item. (Decrease Cooldown affects abilities triggered while it is active, not right before it's used)
- purchase abilities and upgrades intelligently
- automatically update the manual script by periodically checking https://raw.githubusercontent.com/mouseas/steamSummerMinigame/master/autoPlay.js
