// ==UserScript== 
// @name Monster Minigame AutoScript
// @author /u/mouseasw for creating and maintaining the script, /u/WinneonSword for the Greasemonkey support, and every contributor on the GitHub repo for constant enhancements.
// @version 1.5
// @namespace https://github.com/mouseas/steamSummerMinigame
// @description A script that runs the Steam Monster Minigame for you.
// @match http://steamcommunity.com/minigame/towerattack*
// @updateURL https://raw.githubusercontent.com/mouseas/steamSummerMinigame/master/autoPlay.js
// @downloadURL https://raw.githubusercontent.com/mouseas/steamSummerMinigame/master/autoPlay.js
// ==/UserScript==

// IMPORTANT: Update the @version property above to a higher number such as 1.1 and 1.2 when you update the script! Otherwise, Tamper / Greasemonkey users will not update automatically.

var isAlreadyRunning = false;

var ABILITIES = {
	"MORALE_BOOSTER": 5,
	"GOOD_LUCK": 6,
	"MEDIC": 7,
	"METAL_DETECTOR": 8,
	"COOLDOWN": 9,
	"NUKE": 10,
	"CLUSTER_BOMB": 11,
	"NAPALM": 12
};

var ITEMS = {
	"REVIVE": 13,
	"GOLD_RAIN": 17,
	"GOD_MODE": 21,
	"REFLECT_DAMAGE":24,
	"CRIT": 18,
	"CRIPPLE_MONSTER": 15,
	"CRIPPLE_SPAWNER": 14,
	"MAXIMIZE_ELEMENT": 16
}
	
var ENEMY_TYPE = {
	"SPAWNER":0,
	"CREEP":1,
	"BOSS":2,
	"MINIBOSS":3,
	"TREASURE":4
}

// disable particle effects - this drastically reduces the game's memory leak
if (window.g_Minigame !== undefined) {
	window.g_Minigame.CurrentScene().DoClickEffect = function() {};
	window.g_Minigame.CurrentScene().DoCritEffect = function( nDamage, x, y, additionalText ) {};
	window.g_Minigame.CurrentScene().SpawnEmitter = function(emitter) {
		emitter.emit = false;
		return emitter;
	}
}

// disable enemy flinching animation when they get hit
if (window.CEnemy !== undefined) {
	window.CEnemy.prototype.TakeDamage = function() {};
	window.CEnemySpawner.prototype.TakeDamage = function() {};
	window.CEnemyBoss.prototype.TakeDamage = function() {};
}

if (thingTimer !== undefined) {
	window.clearTimeout(thingTimer);
}

function doTheThing() {
	if (isAlreadyRunning || g_Minigame === undefined || !g_Minigame.CurrentScene().m_bRunning || !g_Minigame.CurrentScene().m_rgPlayerTechTree) {
		return;
	}
	isAlreadyRunning = true;
	
	goToLaneWithBestTarget();
	
	useGoodLuckCharmIfRelevant();
	useMedicsIfRelevant();
	useMoraleBoosterIfRelevant();
	useClusterBombIfRelevant();
	useNapalmIfRelevant();
	
	bestdps();
	
	// TODO use abilities if available and a suitable target exists
	// - Tactical Nuke on a Spawner if below 50% and above 25% of its health
	// - Metal Detector if a boss, miniboss, or spawner death is imminent (predicted in > 2 and < 7 seconds)
	// - Morale Booster if available and lane has > 2 live enemies
	// - Decrease Cooldowns right before using another long-cooldown item.
	//       (Decrease Cooldown affects abilities triggered while it is active, not night before it's used)
	
	// TODO purchase abilities and upgrades intelligently
	
	attemptRespawn();
	
	
	
	isAlreadyRunning = false;
}

function goToLaneWithBestTarget() {
	// We can overlook spawners if all spawners are 40% hp or higher and a creep is under 10% hp
	var spawnerOKThreshold = 0.4;
	var creepSnagThreshold = 0.1;
	
	var targetFound = false;
	var lowHP = 0;
	var lowLane = 0;
	var lowTarget = 0;
	var lowPercentageHP = 0;
	
	// determine which lane and enemy is the optimal target
	var enemyTypePriority = [
		ENEMY_TYPE.TREASURE, 
		ENEMY_TYPE.BOSS, 
		ENEMY_TYPE.MINIBOSS,
		ENEMY_TYPE.SPAWNER, 
		ENEMY_TYPE.CREEP
	];
		
	var skippingSpawner = false;
	var skippedSpawnerLane = 0;
	var skippedSpawnerTarget = 0;
	var targetIsTreasureOrBoss = false;
	
	for (var k = 0; !targetFound && k < enemyTypePriority.length; k++) {
		
		if (enemyTypePriority[k] == ENEMY_TYPE.TREASURE || enemyTypePriority[k] == ENEMY_TYPE.BOSS){
			targetIsTreasureOrBoss = true;
		} else {
			targetIsTreasureOrBoss = false;
		}
		
		var enemies = [];
		
		// gather all the enemies of the specified type.
		for (var i = 0; i < 3; i++) {
			for (var j = 0; j < 4; j++) {
				var enemy = g_Minigame.CurrentScene().GetEnemy(i, j);
				if (enemy && enemy.m_data.type == enemyTypePriority[k]) {
					enemies[enemies.length] = enemy;
				}
			}
		}
	
		// target the enemy of the specified type with the lowest hp
		for (var i = 0; i < enemies.length; i++) {
			if (enemies[i] && !enemies[i].m_bIsDestroyed) {
				if (lowHP < 1 || enemies[i].m_flDisplayedHP < lowHP) {
					targetFound = true;
					lowHP = enemies[i].m_flDisplayedHP;
					lowLane = enemies[i].m_nLane;
					lowTarget = enemies[i].m_nID;
				}
				var percentageHP = enemies[i].m_flDisplayedHP / enemies[i].m_data.max_hp;
				if (lowPercentageHP == 0 || percentageHP < lowPercentageHP) {
					lowPercentageHP = percentageHP;
				}
			}
		}
		
		// If we just finished looking at spawners, 
		// AND none of them were below our threshold,  
		// remember them and look for low creeps (so don't quit now)
		if (enemyTypePriority[k] == ENEMY_TYPE.SPAWNER && lowPercentageHP > spawnerOKThreshold) {
			skippedSpawnerLane = lowLane;
			skippedSpawnerTarget = lowTarget;
			skippingSpawner = true;
			targetFound = false;
		}
		
		// If we skipped a spawner and just finished looking at creeps,
		// AND the lowest was above our snag threshold,
		// just go back to the spawner!
		if (skippingSpawner && enemyTypePriority[k] == ENEMY_TYPE.CREEP && lowPercentageHP > creepSnagThreshold ) {
			lowLane = skippedSpawnerLane;
			lowTarget = skippedSpawnerTarget;
		}
	}

	
	// go to the chosen lane
	if (targetFound) {
		if (g_Minigame.CurrentScene().m_nExpectedLane != lowLane) {
			//console.log('switching langes');
			g_Minigame.CurrentScene().TryChangeLane(lowLane);
		}
		
		// target the chosen enemy
		if (g_Minigame.CurrentScene().m_nTarget != lowTarget) {
			//console.log('switching targets');
			g_Minigame.CurrentScene().TryChangeTarget(lowTarget);
		}
		
		
		// Prevent attack abilities and items if up against a boss or treasure minion
		if (targetIsTreasureOrBoss) {
			// Morale
			disableAbility(ABILITIES.MORALE_BOOSTER);
			// Luck
			disableAbility(ABILITIES.GOOD_LUCK);
			// Nuke
			disableAbility(ABILITIES.NUKE);
			// Clusterbomb
			disableAbility(ABILITIES.CLUSTER_BOMB);
			// Napalm
			disableAbility(ABILITIES.NAPALM);
			// Crit
			disableAbilityItem(ITEMS.CRIT);
			// Cripple Spawner
			disableAbilityItem(ITEMS.CRIPPLE_SPAWNER);
			// Cripple Monster
			disableAbilityItem(ITEMS.CRIPPLE_MONSTER);
			// Max Elemental Damage
			disableAbilityItem(ITEMS.MAXIMIZE_ELEMENT);
			// Reflect Damage
			disableAbilityItem(ITEMS.REFLECT_DAMAGE);
		} else {
			// Morale
			enableAbility(ABILITIES.MORALE_BOOSTER);
			// Luck
			enableAbility(ABILITIES.GOOD_LUCK);
			// Nuke
			enableAbility(ABILITIES.NUKE);
			// Clusterbomb
			enableAbility(ABILITIES.CLUSTER_BOMB);
			// Napalm
			enableAbility(ABILITIES.NAPALM);
			// Crit
			enableAbilityItem(ITEMS.CRIT);
			// Cripple Spawner
			enableAbilityItem(ITEMS.CRIPPLE_SPAWNER);
			// Cripple Monster
			enableAbilityItem(ITEMS.CRIPPLE_MONSTER);
			// Max Elemental Damage
			enableAbilityItem(ITEMS.MAXIMIZE_ELEMENT);
			// Reflect Damage
			enableAbilityItem(ITEMS.REFLECT_DAMAGE);
		}
	}
}

function useMedicsIfRelevant() {
	var myMaxHealth = g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp;
	
	// check if health is below 50%
	var hpPercent = g_Minigame.CurrentScene().m_rgPlayerData.hp / myMaxHealth;
	if (hpPercent > 0.5 || g_Minigame.CurrentScene().m_rgPlayerData.hp < 1) {
		if (hpPercent < 0.6 && g_Minigame.CurrentScene().m_rgPlayerData.hp > 0) {
			besthp();
		} else {
			return; // no need to heal - HP is above 50% or already dead
		}
	}
	
	// check if Medics is purchased and cooled down
	if (hasPurchasedAbility(ABILITIES.MEDIC) && !isAbilityCoolingDown(ABILITIES.MEDIC)) {

		// Medics is purchased, cooled down, and needed. Trigger it.
		console.log('Medics is purchased, cooled down, and needed. Trigger it.');
		triggerAbility(ABILITIES.MEDIC);
	} else if (hasItem(ITEMS.GOD_MODE) && !isAbilityCoolingDown(ITEMS.GOD_MODE)) {
		
		console.log('We have god mode, cooled down, and needed. Trigger it.');
		triggerItem(ITEMS.GOD_MODE);
	}
};

// Use Good Luck Charm if doable
function useGoodLuckCharmIfRelevant() {
	// check if Good Luck Charms is purchased and cooled down
	if (hasPurchasedAbility(ABILITIES.GOOD_LUCK)) {
		if (isAbilityCoolingDown(ABILITIES.GOOD_LUCK)) {
			return;
		}
		
		if (! isAbilityEnabled(ABILITIES.GOOD_LUCK)) {
			return;
		}

		// Good Luck Charms is purchased, cooled down, and needed. Trigger it.
		console.log('Good Luck Charms is purchased, cooled down, and needed. Trigger it.');
		triggerAbility(ABILITIES.GOOD_LUCK);
	}
}

function useClusterBombIfRelevant() {
	//Check if Cluster Bomb is purchased and cooled down
	if (hasPurchasedAbility(ABILITIES.CLUSTER_BOMB)) {
		if (isAbilityCoolingDown(ABILITIES.CLUSTER_BOMB)) {
			return;
		}
		
		//Check lane has monsters to explode
		var currentLane = g_Minigame.CurrentScene().m_nExpectedLane;
		var enemyCount = 0;
		var enemySpawnerExists = false;
		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = g_Minigame.CurrentScene().GetEnemy(currentLane, i);
			if (enemy) {
				enemyCount++;
				if (enemy.m_data.type == 0) { 
					enemySpawnerExists = true;
				}
			}
		}
		//Bombs away if spawner and 2+ other monsters
		if (enemySpawnerExists && enemyCount >= 3) {
			triggerAbility(ABILITIES.CLUSTER_BOMB);
		}
	}
}

function useNapalmIfRelevant() {
	//Check if Napalm is purchased and cooled down
	if (hasPurchasedAbility(ABILITIES.NAPALM)) {
		if (isAbilityCoolingDown(ABILITIES.NAPALM)) {
			return;
		}
		
		//Check lane has monsters to burn
		var currentLane = g_Minigame.CurrentScene().m_nExpectedLane;
		var enemyCount = 0;
		var enemySpawnerExists = false;
		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = g_Minigame.CurrentScene().GetEnemy(currentLane, i);
			if (enemy) {
				enemyCount++;
				if (enemy.m_data.type == 0) { 
					enemySpawnerExists = true;
				}
			}
		}
		//Burn them all if spawner and 2+ other monsters
		if (enemySpawnerExists && enemyCount >= 3) {
			triggerAbility(ABILITIES.NAPALM);
		}
	}
}

function useMoraleBoosterIfRelevant() {
	// Check if Morale Booster is purchased
	if(hasPurchasedAbility(5)) {
		if (isAbilityCoolingDown(5)) {
			return;
		}
		
		//Check lane has monsters so the hype isn't wasted
		var currentLane = g_Minigame.CurrentScene().m_nExpectedLane;
		var enemyCount = 0;
		var enemySpawnerExists = false;
		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = g_Minigame.CurrentScene().GetEnemy(currentLane, i);
			if (enemy) {
				enemyCount++;
				if (enemy.m_data.type == 0) { 
					enemySpawnerExists = true;
				}
			}
		}
		//Hype everybody up!
		if (enemySpawnerExists && enemyCount >= 3) {
			triggerAbility(5);
		}
	}
}

//If player is dead, call respawn method
function attemptRespawn() {
	if ((g_Minigame.CurrentScene().m_bIsDead) && 
			((g_Minigame.CurrentScene().m_rgPlayerData.time_died * 1000) + 5000) < (new Date().getTime())) {
		RespawnPlayer();
	}
}

function isAbilityActive(abilityId) {
	return g_Minigame.CurrentScene().bIsAbilityActive(abilityId);
}

function hasItem(itemId) {
	for ( var i = 0; i < g_Minigame.CurrentScene().m_rgPlayerTechTree.ability_items.length; ++i ) {
		var abilityItem = g_Minigame.CurrentScene().m_rgPlayerTechTree.ability_items[i];
		if (abilityItem.ability == itemId) {
			return true;
		}
	}
	return false;
}

function isAbilityCoolingDown(abilityId) {
	return g_Minigame.CurrentScene().GetCooldownForAbility(abilityId) > 0;
}

function hasPurchasedAbility(abilityId) {
	// each bit in unlocked_abilities_bitfield corresponds to an ability.
	// the above condition checks if the ability's bit is set or cleared. I.e. it checks if
	// the player has purchased the specified ability.
	return (1 << abilityId) & g_Minigame.CurrentScene().m_rgPlayerTechTree.unlocked_abilities_bitfield;
}

function triggerItem(itemId) {
	var elem = document.getElementById('abilityitem_' + itemId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		g_Minigame.CurrentScene().TryAbility(document.getElementById('abilityitem_' + itemId).childElements()[0]);
	}
}

function triggerAbility(abilityId) {
	var elem = document.getElementById('ability_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		g_Minigame.CurrentScene().TryAbility(document.getElementById('ability_' + abilityId).childElements()[0]);
	}
}

function disableAbility(abilityId) {
	var elem = document.getElementById('ability_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = "hidden";
	}
}

function enableAbility(abilityId) {
	var elem = document.getElementById('ability_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = "visible";
	}
}

function isAbilityEnabled(abilityId) {
	var elem = document.getElementById('ability_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		return  elem.childElements()[0].style.visibility == "visible";
	}
	return false;
}

function disableAbilityItem(abilityId) {
	var elem = document.getElementById('abilityitem_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = "hidden";
	}
}

function enableAbilityItem(abilityId) {
	var elem = document.getElementById('abilityitem_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = "visible";
	}
}

function isAbilityItemEnabled(abilityId) {
	var elem = document.getElementById('abilityitem_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		return  elem.childElements()[0].style.visibility == "visible";
	}
	return false;
}
//AUTOCLICKERS change this variable below this
var clickpersec = 10
function bestclick() {
	if (g_Minigame.CurrentScene().m_bUpgradesBusy == false) {
		var click1 = g_Minigame.CurrentScene().m_rgPlayerUpgrades[2].cost_for_next_level/1.3;
		var click1count = g_Minigame.CurrentScene().m_rgPlayerUpgrades[2].level;
		var click2 = g_Minigame.CurrentScene().m_rgPlayerUpgrades[10].cost_for_next_level/10;
		var click2count = g_Minigame.CurrentScene().m_rgPlayerUpgrades[10].level;
		var click3 = g_Minigame.CurrentScene().m_rgPlayerUpgrades[22].cost_for_next_level/100;
		if ((click2 < click1)&&(click1count > 9)) {
			if ((click3 < click2)&&(click2count > 9)) {
				//console.log('click3');
				return 22;
				//g_Minigame.CurrentScene().TryUpgrade(22);
			} else {
				//console.log('click2');
				return 10;
				//g_Minigame.CurrentScene().TryUpgrade(10);
			}
		} else {
			if ((click3 < click1)&&(click2count > 9)) {
				//console.log('click3');
				return 22;
				//g_Minigame.CurrentScene().TryUpgrade(22);
			} else {
				//console.log('click1');
				return 2;
				//g_Minigame.CurrentScene().TryUpgrade(2);
			}
		};
	};
}
//g_Minigame.CurrentScene().TryUpgrade(document.getElementById('upgr_' + 20).childElements()[0].childElements()[1])

function bestauto() {
	if (g_Minigame.CurrentScene().m_bUpgradesBusy == false) {
		var auto1 = g_Minigame.CurrentScene().m_rgPlayerUpgrades[1].cost_for_next_level/1;
		var auto1count = g_Minigame.CurrentScene().m_rgPlayerUpgrades[1].level;
		var auto2 = g_Minigame.CurrentScene().m_rgPlayerUpgrades[9].cost_for_next_level/10;
		var auto2count = g_Minigame.CurrentScene().m_rgPlayerUpgrades[9].level;
		var auto3 = g_Minigame.CurrentScene().m_rgPlayerUpgrades[21].cost_for_next_level/100;
		if ((auto2 < auto1)&&(auto1count > 9)) {
			if ((auto3 < auto2)&&(auto2count > 9)) {
				//console.log('auto3');
				return 21;
				//g_Minigame.CurrentScene().TryUpgrade(22);
			} else {
				//console.log('auto2');
				return 9;
				//g_Minigame.CurrentScene().TryUpgrade(10);
			}
		} else {
			if ((auto3 < auto1)&&(auto2count > 9)) {
				//console.log('auto3');
				return 21;
				//g_Minigame.CurrentScene().TryUpgrade(22);
			} else {
				//console.log('auto1');
				return 1;
				//g_Minigame.CurrentScene().TryUpgrade(2);
			}
		};
	};
}

function bestcrit() {
	var critcount = g_Minigame.CurrentScene().m_rgPlayerUpgrades[7].level;
	var critcost = g_Minigame.CurrentScene().m_rgPlayerUpgrades[7].cost_for_next_level;
	var critrate = g_Minigame.CurrentScene().m_rgPlayerTechTree.crit_percentage/100
	return critcost/(1.5*(clickpersec)*critrate);
}

function bestdps() {
	var clickbest = bestclick();
	var autobest = bestauto();
	var critbestcost = bestcrit();
	if (clickbest == 2) {
		var clickmod = 1
	} else if (clickbest == 10) {
		var clickmod = 10;
	} else {
		var clickmod = 100;
	};
	if (autobest == 2) {
		var automod = 1
	} else if (autobest == 9) {
		var automod = 10;
	} else {
		var automod = 100;
	};
	var clickbestcost = g_Minigame.CurrentScene().m_rgPlayerUpgrades[clickbest].cost_for_next_level/(clickmod*clickpersec);
	var autobestcost = g_Minigame.CurrentScene().m_rgPlayerUpgrades[autobest].cost_for_next_level/automod;
	if (clickbestcost < autobestcost) {
		if (critbestcost < clickbestcost) {
			buyupgrade(7);
		} else {
			buyupgrade(clickbest);
		}
	} else {
		if (critbestcost < autobestcost) {
			buyupgrade(7);
		} else {
			buyupgrade(autobest);
		}
	};
}

function besthp() {
	if (g_Minigame.CurrentScene().m_bUpgradesBusy == false) {
		var hp1 = g_Minigame.CurrentScene().m_rgPlayerUpgrades[0].cost_for_next_level/1.3;
		var hp1count = g_Minigame.CurrentScene().m_rgPlayerUpgrades[0].level;
		var hp2 = g_Minigame.CurrentScene().m_rgPlayerUpgrades[8].cost_for_next_level/10;
		var hp2count = g_Minigame.CurrentScene().m_rgPlayerUpgrades[8].level;
		var hp3 = g_Minigame.CurrentScene().m_rgPlayerUpgrades[20].cost_for_next_level/100;
		if ((hp2 < hp1)&&(hp1count > 9)) {
			if ((hp3 < hp2)&&(hp2count > 9)) {
				//console.log('hp3');
				buyupgrade(20);
				//g_Minigame.CurrentScene().TryUpgrade(20);
			} else {
				//console.log('hp2');
				buyupgrade(8);
				//g_Minigame.CurrentScene().TryUpgrade(8);
			}
		} else {
			if ((hp3 < hp1)&&(hp2count > 9)) {
				//console.log('hp3');
				buyupgrade(20);
				//g_Minigame.CurrentScene().TryUpgrade(20);
			} else {
				//console.log('hp1');
				buyupgrade(0);
				//g_Minigame.CurrentScene().TryUpgrade(0);
			}
		};
	};
}

function buyupgrade(upgr_id) {
	g_Minigame.CurrentScene().TryUpgrade(document.getElementById('upgr_' + upgr_id).childElements()[0].childElements()[1])
}
var thingTimer = window.setInterval(doTheThing, 1000);
