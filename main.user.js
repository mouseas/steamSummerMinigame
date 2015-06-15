// ==UserScript== 
// @name Monster Minigame AutoScript
// @author /u/mouseasw for creating and maintaining the script, /u/WinneonSword for the Greasemonkey support, and every contributor on the GitHub repo for constant enhancements.
// @version 2.3.5
// @namespace https://github.com/mouseas/steamSummerMinigame
// @description A script that runs the Steam Monster Minigame for you.
// @match *://steamcommunity.com/minigame/towerattack*
// @match *://steamcommunity.com//minigame/towerattack*
// @grant none
// @updateURL https://raw.githubusercontent.com/mouseas/steamSummerMinigame/master/main.user.js
// @downloadURL https://raw.githubusercontent.com/mouseas/steamSummerMinigame/master/main.user.js
// ==/UserScript==

///////////////////////////////////////////////////////////
//  ___ __  __ ____   ___  ____ _____  _    _   _ _____  //
// |_ _|  \/  |  _ \ / _ \|  _ \_   _|/ \  | \ | |_   _| //
//  | || |\/| | |_) | | | | |_) || | / _ \ |  \| | | |   //
//  | || |  | |  __/| |_| |  _ < | |/ ___ \| |\  | | |   //
// |___|_|  |_|_|    \___/|_| \_\|_/_/   \_\_| \_| |_|   //
//                                                       //
//    Increment the @version parameter every time you    //
//   update the script (2.0.1, 2.0.2, etc.). Otherwise   //
//   Greasemonkey / Tampermonkey users will NOT update   //
//                    automatically!!                    //
//                                                       //
///////////////////////////////////////////////////////////

var isAlreadyRunning = false;
var autoClickGoldRain = true;
var purchaseUpgradeToggle = true;

var clickRate = 10; // change to number of desired clicks per second
var timer = 0;
var lastAction = 500; //start with the max. Array length
var clickTimer;
var purchasedShieldsWhileRespawning = false;

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
    "CRIPPLE_SPAWNER": 14,
    "CRIPPLE_MONSTER": 15,
    "MAXIMIZE_ELEMENT": 16,
    "GOLD_RAIN": 17,
    "CRIT": 18,
    "PUMPED_UP": 19,
    "THROW_MONEY": 20,
    "GOD_MODE": 21,
    "TREASURE": 22,
    "STEAL_HEALTH": 23,
    "REFLECT_DAMAGE": 24
};

var ENEMY_TYPE = {
    "SPAWNER": 0,
    "CREEP": 1,
    "BOSS": 2,
    "MINIBOSS": 3,
    "TREASURE": 4
};

// Each elemental damage, lucky shot and loot have their own type in m_rgTuningData
var UPGRADE_TYPES = {
	"ARMOR": 0,
	"DPS": 1,
	"CLICK_DAMAGE": 2,
	"ELEMENTAL_FIRE": 3,
	"ELEMENTAL_WATER": 4,
	"ELEMENTAL_AIR": 5,
	"ELEMENTAL_EARTH": 6,
	"LUCKY_SHOT": 7,
	"ABILITY": 8,
	"LOOT": 9
};

if (thingTimer){
	window.clearInterval(thingTimer);
}

function firstRun() {
	// if the purchase item window is open, spend your badge points!
	if (g_Minigame.CurrentScene().m_UI.m_spendBadgePointsDialog.is(":visible")) {
		purchaseBadgeItems();
	}

	// disable particle effects - this drastically reduces the game's memory leak
	if (g_Minigame !== undefined) {
		g_Minigame.CurrentScene().DoClickEffect = function() {};
		g_Minigame.CurrentScene().DoCritEffect = function( nDamage, x, y, additionalText ) {};
		g_Minigame.CurrentScene().SpawnEmitter = function(emitter) {
			emitter.emit = false;
			return emitter;
		};
	}

	// disable enemy flinching animation when they get hit
	if (CEnemy !== undefined) {
		CEnemy.prototype.TakeDamage = function() {};
		CEnemySpawner.prototype.TakeDamage = function() {};
		CEnemyBoss.prototype.TakeDamage = function() {};
	}
}

function doTheThing() {
	if (!isAlreadyRunning){
		isAlreadyRunning = true;

		goToLaneWithBestTarget();

		if (purchaseUpgradeToggle){
			purchaseUpgrades();
		}

		useGoodLuckCharmIfRelevant();
		useCritIfRelevant();
		useMedicsIfRelevant();
		useMoraleBoosterIfRelevant();
		useClusterBombIfRelevant();
		useNapalmIfRelevant();
		useTacticalNukeIfRelevant();
		useCrippleSpawnerIfRelevant();
		useMetalDetectorIfRelevant();
		useGoldRainIfRelevant();
		attemptRespawn();

		if(autoClickGoldRain) {
			startGoldRainClick();
		}

		isAlreadyRunning = false;
	}
}

function purchaseBadgeItems() {
	// Spends badge points (BP's) when joining a new game.
	// Dict contains the priority in terms of amount to buy (percentage of purchase). Probably a nicer way to do this...
	// First version of priorities is based on this badge point table 'usefulness' from reddit:
	// http://www.reddit.com/r/Steam/comments/39i0qc/psa_how_the_monster_game_works_an_indepth/
	var abilityItemPriority = [
		[ITEMS.GOLD_RAIN, 50],
		[ITEMS.CRIPPLE_MONSTER, 10],
		[ITEMS.CRIPPLE_SPAWNER, 8],
		[ITEMS.MAXIMIZE_ELEMENT, 7],
		[ITEMS.CRIT, 5],
		[ITEMS.TREASURE, 5],
		[ITEMS.REVIVE, 5],
		[ITEMS.STEAL_HEALTH, 4],
		[ITEMS.GOD_MODE, 3],
		[ITEMS.REFLECT_DAMAGE, 2],
		[ITEMS.PUMPED_UP, 1]
		//[ITEMS.THROW_MONEY, 0]
		// Only go up to the second-last item. Throw money
		// should never be used, but it's here just in case.
	];

	// Being extra paranoid about spending, since abilities update slowly.
	var safeToBuy = true;
	var intervalID = window.setInterval( function() {
		var queueLen = g_Minigame.CurrentScene().m_rgPurchaseItemsQueue.length;
		if (safeToBuy && queueLen > 0)
			safeToBuy = false;
		else if (!safeToBuy && queueLen === 0)
			safeToBuy = true;
	}, 100);

	var buyItem = function(id) {
		g_Minigame.CurrentScene().TrySpendBadgePoints(document.getElementById('purchase_abilityitem_' + id));
	};

	var badgePoints = g_Minigame.CurrentScene().m_rgPlayerTechTree.badge_points;

	for (var i = 0; i < abilityItemPriority.length; i++) {
		var abilityItem = abilityItemPriority[i];
		var cost = $J(document.getElementById('purchase_abilityitem_' + abilityItem[0])).data('cost');

		// Maximum amount to spend on each upgrade. i.e. 100 BP on item with a 10% share = 10 BP
		var maxSpend = badgePoints * abilityItem[1] / 100;
		var spent = 0;

		// Don't over-spend the budget for each item, and don't overdraft on the BP
		while (spent < maxSpend && cost <= g_Minigame.CurrentScene().m_rgPlayerTechTree.badge_points) {
			if (!safeToBuy)
				continue;
			buyItem(abilityItem[0]);
			spent += cost;
		}
	}
	
	// Get any stragling 1 or 2 BP left over, using the last item (1 BP) in the priority array
	while (g_Minigame.CurrentScene().m_rgPlayerTechTree.badge_points > 0) {
		if (!safeToBuy)
			continue;
		buyItem(abilityItemPriority[abilityItemPriority.length - 1][0]);
	}

	// Get rid of that interval, it could end up taking up too many resources
	window.clearInterval(intervalID);
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


function purchaseUpgrades() {
	var oddsOfElement = 1 - (0.75*0.75*0.75); //This values elemental too much because best element lanes are not focused(0.578)
	var avgClicksPerSecond = 1;	//Set this yourself to serve your needs
	
	var upgrades = g_Minigame.CurrentScene().m_rgTuningData.upgrades.slice(0);

	var buyUpgrade = function(id) {
		console.log("Buying " + upgrades[id].name + " level " + (g_Minigame.CurrentScene().GetUpgradeLevel(id) + 1));
		if(id >= 3 && 6 >= id) { //If upgrade is element damage
			g_Minigame.CurrentScene().TryUpgrade(document.getElementById('upgr_' + id).childElements()[3]);
		} else {
			g_Minigame.CurrentScene().TryUpgrade(document.getElementById('upgr_' + id).childElements()[0].childElements()[1]);
		}
	};
	
	var myGold = g_Minigame.CurrentScene().m_rgPlayerData.gold;
	
	//Initial values for armor & damage
	var bestUpgradeForDamage,bestUpgradeForArmor;
	var highestUpgradeValueForDamage = 0;
	var highestUpgradeValueForArmor = 0;
	var bestElement = -1;
	var highestElementLevel = 0;
	
	var critMultiplier = g_Minigame.CurrentScene().m_rgPlayerTechTree.damage_multiplier_crit;
	var critRate = Math.min(g_Minigame.CurrentScene().m_rgPlayerTechTree.crit_percentage, 1);
	var dpc = g_Minigame.CurrentScene().m_rgPlayerTechTree.damage_per_click;
	var basedpc = g_Minigame.CurrentScene().m_rgTuningData.player.damage_per_click;
	
	for( var i=0; i< upgrades.length; i++ ) {
		var upgrade = upgrades[i];
		
		if ( upgrade.required_upgrade != undefined )
		{
			var requiredUpgradeLevel = upgrade.required_upgrade_level != undefined ? upgrade.required_upgrade_level : 1;
			var parentUpgradeLevel = g_Minigame.CurrentScene().GetUpgradeLevel(upgrade.required_upgrade);
			if ( requiredUpgradeLevel > parentUpgradeLevel )
			{
				//If upgrade is not available, we skip it
				continue;
			}
		}
	
		var upgradeCurrentLevel = g_Minigame.CurrentScene().GetUpgradeLevel(i);
		var upgradeCost = g_Minigame.CurrentScene().GetUpgradeCost(i);
		
		switch(upgrade.type) {
			case UPGRADE_TYPES.ARMOR:
				if(upgrade.multiplier / upgradeCost > highestUpgradeValueForArmor) { // hp increase per moneys
					bestUpgradeForArmor = i;
					highestUpgradeValueForArmor = upgrade.multiplier / upgradeCost;
				}
				break;
			case UPGRADE_TYPES.CLICK_DAMAGE:
				if((critRate * critMultiplier + (1 - critRate)) * avgClicksPerSecond * upgrade.multiplier * basedpc / upgradeCost > highestUpgradeValueForDamage) { // dmg increase per moneys
					bestUpgradeForDamage = i;
					highestUpgradeValueForDamage = (critRate * critMultiplier + (1 - critRate)) * avgClicksPerSecond * upgrade.multiplier * basedpc / upgradeCost;
				}
				break;
			case UPGRADE_TYPES.DPS:
				if(upgrade.multiplier / upgradeCost > highestUpgradeValueForDamage) { // dmg increase per moneys
					bestUpgradeForDamage = i;
					highestUpgradeValueForDamage = upgrade.multiplier / upgradeCost;
				}
				break;
			case UPGRADE_TYPES.ELEMENTAL_FIRE:
			case UPGRADE_TYPES.ELEMENTAL_WATER:
			case UPGRADE_TYPES.ELEMENTAL_AIR:
			case UPGRADE_TYPES.ELEMENTAL_EARTH:
				/*if(upgradeCurrentLevel > highestElementLevel){
					highestElementLevel = upgradeCurrentLevel;
					bestElement = i;
				}*/
				break;
			case UPGRADE_TYPES.LUCKY_SHOT:
				if(upgrade.multiplier * dpc * critRate * avgClicksPerSecond / upgradeCost > highestUpgradeValueForDamage) { // dmg increase per moneys
					bestUpgradeForDamage = i;
					highestUpgradeValueForDamage = upgrade.multiplier / upgradeCost;
				}
				break;
			default:
				break;
		}
	}
	/*
	if(bestElement != -1) {
		//Let user choose what element to level up by adding the point to desired element
		upgradeCost = g_Minigame.CurrentScene().GetUpgradeCost(bestElement);
		
		var dps = g_Minigame.CurrentScene().m_rgPlayerTechTree.dps;
		dps = dps + (g_Minigame.CurrentScene().m_rgPlayerTechTree.damage_per_click * avgClicksPerSecond);
		if(0.25 * oddsOfElement * dps * upgrades[bestElement].multiplier / upgradeCost > highestUpgradeValueForDamage) { //dmg increase / moneys
			//bestUpgradeForDamage = bestElement; // Not doing this because this values element damage too much
		}
	}*/

	var currentHealth = g_Minigame.CurrentScene().m_rgPlayerData.hp;
	var myMaxHealth = g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp;
	// check if health is below 30%
	var hpPercent = currentHealth / myMaxHealth;
	if (hpPercent < 0.3) {
		// Prioritize armor over damage
		// - Should we by any armor we can afford or just wait for the best one possible?
		//	 currently waiting
		upgradeCost = g_Minigame.CurrentScene().GetUpgradeCost(bestUpgradeForArmor);

		// Prevent purchasing multiple shields while waiting to respawn.
		if (purchasedShieldsWhileRespawning && currentHealth < 1) {
			return;
		}

		if(myGold > upgradeCost && bestUpgradeForArmor) {
			buyUpgrade(bestUpgradeForArmor);
			myGold = g_Minigame.CurrentScene().m_rgPlayerData.gold;

			purchasedShieldsWhileRespawning = currentHealth < 1;
		}
	}
	else if (purchasedShieldsWhileRespawning) {
		purchasedShieldsWhileRespawning = false;
	}
	
	// Try to buy some damage
	upgradeCost = g_Minigame.CurrentScene().GetUpgradeCost(bestUpgradeForDamage);

	if(myGold > upgradeCost && bestUpgradeForDamage) {
		buyUpgrade(bestUpgradeForDamage);
	}
}

function useMedicsIfRelevant() {
	var myMaxHealth = g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp;
	
	// check if health is below 50%
	var hpPercent = g_Minigame.CurrentScene().m_rgPlayerData.hp / myMaxHealth;
	if (hpPercent > 0.5 || g_Minigame.CurrentScene().m_rgPlayerData.hp < 1) {
		return; // no need to heal - HP is above 50% or already dead
	}
	
	// check if Medics is purchased and cooled down
	if(numItem(ITEMS.PUMPED_UP) > 0 && !isAbilityCoolingDown(ITEMS.PUMPED_UP)) {
		// the item PUMPED UP will be the first used in order to regenerate our health
		console.log('We can pump up our HP. Trigger it.');
		triggerItem(ITEMS.PUMPED_UP);
	} else if (hasPurchasedAbility(ABILITIES.MEDIC) && !isAbilityCoolingDown(ABILITIES.MEDIC)) {
		// Medics is purchased, cooled down, and needed. Trigger it.
		// This is because PUMPED_UP is basically a better version of "MEDIC"
		// and it gets dropped by monsters as loot
		console.log('Medics is purchased, cooled down, and needed. Trigger it.');
		triggerAbility(ABILITIES.MEDIC);
	} else if (numItem(ITEMS.GOD_MODE) > 0 && !isAbilityCoolingDown(ITEMS.GOD_MODE)) {
		// Don't have Medic or Pumped Up? 
		// We'll use godmode so we can delay our death in case the cooldowns come back.
		// Instead of just firing it, we could maybe only use godmode
		// if the medic / pumped up ability is going to be back before godmode expires
		console.log('We have god mode, cooled down, and needed. Trigger it.');
		triggerItem(ITEMS.GOD_MODE);
	} else if(numItem(ITEMS.STEAL_HEALTH) > 0 && !isAbilityCoolingDown(ITEMS.STEAL_HEALTH)) {
		// Use Steal Health as a last resort as that 
		// allows us to gain HP depending on our click-damage
		console.log("Last resort for survival: STEALING HEALTH");
		triggerItem(ITEMS.STEAL_HEALTH);
	}
}

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
			// Wait 60 seconds if the cooldown ability
			// is within 1 minute of coming back
			if (getCooldownTime(ABILITIES.COOLDOWN) > 60 || !hasPurchasedAbility(ABILITIES.COOLDOWN) || (hasPurchasedAbility(ABILITIES.COOLDOWN) && !isAbilityCoolingDown(ABILITIES.COOLDOWN))) {
				if (hasPurchasedAbility(ABILITIES.COOLDOWN) && !isAbilityCoolingDown(ABILITIES.COOLDOWN) && !currentLaneHasAbility(ABILITIES.COOLDOWN)) {
					console.log("Cooling down prior to long-downtime ability use");
					triggerAbility(ABILITIES.COOLDOWN);
				} else {
					triggerAbility(ABILITIES.CLUSTER_BOMB);
				}
			}
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
			// Wait 60 seconds if the cooldown ability
			// is within 1 minute of coming back
			if (getCooldownTime(ABILITIES.COOLDOWN) > 60 || !hasPurchasedAbility(ABILITIES.COOLDOWN) || (hasPurchasedAbility(ABILITIES.COOLDOWN) && !isAbilityCoolingDown(ABILITIES.COOLDOWN))) {
				if (hasPurchasedAbility(ABILITIES.COOLDOWN) && !isAbilityCoolingDown(ABILITIES.COOLDOWN) && !currentLaneHasAbility(ABILITIES.COOLDOWN)) {
					console.log("Cooling down prior to long-downtime ability use");
					triggerAbility(ABILITIES.COOLDOWN);
				} else {
					triggerAbility(ABILITIES.NAPALM);
				}
			}
		}
	}
}

function useMoraleBoosterIfRelevant() {
	// Check if Morale Booster is purchased
	if (hasPurchasedAbility(ABILITIES.MORALE_BOOSTER)) {
		if (isAbilityCoolingDown(ABILITIES.MORALE_BOOSTER)) {
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
			console.log("Morale Booster is purchased, cooled down, and needed. Rally around, everyone!");
			triggerAbility(ABILITIES.MORALE_BOOSTER);
		}
	}
}

function useTacticalNukeIfRelevant() {
	// Check if Tactical Nuke is purchased
	if(hasPurchasedAbility(ABILITIES.NUKE)) {
		if (isAbilityCoolingDown(ABILITIES.NUKE)) {
			return;
		}

		//Check that the lane has a spawner and record it's health percentage
		var currentLane = g_Minigame.CurrentScene().m_nExpectedLane;
		var enemySpawnerExists = false;
		var enemySpawnerHealthPercent = 0.0;
		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = g_Minigame.CurrentScene().GetEnemy(currentLane, i);
			if (enemy) {
				if (enemy.m_data.type == 0) {
					enemySpawnerExists = true;
					enemySpawnerHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;
				}
			}
		}

		// If there is a spawner and it's health is between 60% and 30%, nuke it!
		if (enemySpawnerExists && enemySpawnerHealthPercent < 0.6 && enemySpawnerHealthPercent > 0.3) {
			console.log("Tactical Nuke is purchased, cooled down, and needed. Nuke 'em.");
			// Wait 60 seconds if the cooldown ability
			// is within 1 minute of coming back
			if (getCooldownTime(ABILITIES.COOLDOWN) > 60 || !hasPurchasedAbility(ABILITIES.COOLDOWN) || (hasPurchasedAbility(ABILITIES.COOLDOWN) && !isAbilityCoolingDown(ABILITIES.COOLDOWN))) {
				if (hasPurchasedAbility(ABILITIES.COOLDOWN) && !isAbilityCoolingDown(ABILITIES.COOLDOWN) && !currentLaneHasAbility(ABILITIES.COOLDOWN)) {
					console.log("Cooling down prior to long-downtime ability use");
					triggerAbility(ABILITIES.COOLDOWN);
				} else {
					triggerAbility(ABILITIES.NUKE);
				}
			}
		}
	}
}

function useMetalDetectorIfRelevant() {
	if (hasPurchasedAbility(ABILITIES.METAL_DETECTOR)) {
		if (isAbilityCoolingDown(ABILITIES.METAL_DETECTOR)) {
			return;
		}

		var enemy = g_Minigame.m_CurrentScene.GetEnemy(g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane, g_Minigame.m_CurrentScene.m_rgPlayerData.target);

		if (enemy && enemy.m_data.type == ENEMY_TYPE.BOSS) {
			var enemyBossHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;

			if (enemyBossHealthPercent < 0.3 ) {
				console.log('Metal detector is purchased and cooled down, Triggering it on boss');
				triggerAbility(ABILITIES.METAL_DETECTOR);
			}
		}
	}
}

function useCrippleSpawnerIfRelevant() {
	// Check if Cripple Spawner is available
	if(numItem(ITEMS.CRIPPLE_SPAWNER) > 0) {
		if (isAbilityCoolingDown(ITEMS.CRIPPLE_SPAWNER)) {
			return;
		}

		//Check that the lane has a spawner and record it's health percentage
		var currentLane = g_Minigame.CurrentScene().m_nExpectedLane;
		var enemySpawnerExists = false;
		var enemySpawnerHealthPercent = 0.0;
		//Count each slot in lane
		for (var i = 0; i < 4; i++) {
			var enemy = g_Minigame.CurrentScene().GetEnemy(currentLane, i);
			if (enemy) {
				if (enemy.m_data.type == 0) {
					enemySpawnerExists = true;
					enemySpawnerHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;
				}
			}
		}

		// If there is a spawner and it's health is above 95%, cripple it!
		if (enemySpawnerExists && enemySpawnerHealthPercent > 0.95) {
			console.log("Cripple Spawner available, and needed. Cripple 'em.");
			triggerItem(ITEMS.CRIPPLE_SPAWNER);
		}
	}
}

function useGoldRainIfRelevant() {
	// Check if gold rain is purchased
	if (numItem(ITEMS.GOLD_RAIN) > 0) {
		if (isAbilityCoolingDown(ITEMS.GOLD_RAIN)) {
			return;
		}

		if(Math.random() > g_Minigame.CurrentScene().m_rgGameData.level / 10000) {
	        	return;
	        }

		var enemy = g_Minigame.m_CurrentScene.GetEnemy(g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane, g_Minigame.m_CurrentScene.m_rgPlayerData.target);
		// check if current target is a boss, otherwise its not worth using the gold rain
		if (enemy && enemy.m_data.type == ENEMY_TYPE.BOSS) {	
			var enemyBossHealthPercent = enemy.m_flDisplayedHP / enemy.m_data.max_hp;

			if (enemyBossHealthPercent >= 0.3) { // We want sufficient time for the gold rain to be applicable
				// Gold Rain is purchased, cooled down, and needed. Trigger it.
				console.log('Gold rain is purchased and cooled down, Triggering it on boss');
				triggerItem(ITEMS.GOLD_RAIN);
			}
		}
	}
}

// Upgrades the crit by 1% if we have the CRIT item available for use.
function useCritIfRelevant() {
	if(numItem(ITEMS.CRIT) > 0 && !isAbilityCoolingDown(ITEMS.CRIT))
	{
		triggerItem(ITEMS.CRIT);
	}
}

//If player is dead, call respawn method
function attemptRespawn() {
	if ((g_Minigame.CurrentScene().m_bIsDead) && 
			((g_Minigame.CurrentScene().m_rgPlayerData.time_died) + 5) < (g_Minigame.CurrentScene().m_nTime)) {
		RespawnPlayer();
	}
}

function isAbilityActive(abilityId) {
	return g_Minigame.CurrentScene().bIsAbilityActive(abilityId);
}

function numItem(itemId) {
	for ( var i = 0; i < g_Minigame.CurrentScene().m_rgPlayerTechTree.ability_items.length; ++i ) {
		var abilityItem = g_Minigame.CurrentScene().m_rgPlayerTechTree.ability_items[i];
		if (abilityItem.ability == itemId) {
			return abilityItem.quantity;
		}
	}
	return 0;
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

function toggleAbilityVisibility(abilityId, show) {
	var vis = show === true ? "visible" : "hidden";

	var elem = document.getElementById('ability_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = vis;
	}
}

function disableAbility(abilityId) {
	toggleAbilityVisibility(abilityId, false);
}

function enableAbility(abilityId) {
	toggleAbilityVisibility(abilityId, true);
}

function isAbilityEnabled(abilityId) {
	var elem = document.getElementById('ability_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		return elem.childElements()[0].style.visibility == "visible";
	}
	return false;
}

function toggleAbilityItemVisibility(abilityId, show) {
	var vis = show === true ? "visible" : "hidden";

	var elem = document.getElementById('abilityitem_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		elem.childElements()[0].style.visibility = show;
	}
}

function disableAbilityItem(abilityId) {
	toggleAbilityItemVisibility(abilityId, false);
}

function enableAbilityItem(abilityId) {
	toggleAbilityItemVisibility(abilityId, true);
}

function isAbilityItemEnabled(abilityId) {
	var elem = document.getElementById('abilityitem_' + abilityId);
	if (elem && elem.childElements() && elem.childElements().length >= 1) {
		return elem.childElements()[0].style.visibility == "visible";
	}
	return false;
}

function currentLaneHasAbility(abilityID) {
	var lane = g_Minigame.CurrentScene().m_rgPlayerData.current_lane;
	if (typeof(g_Minigame.m_CurrentScene.m_rgLaneData[lane].abilities[abilityID]) == 'undefined')
		return 0;
	return g_Minigame.m_CurrentScene.m_rgLaneData[lane].abilities[abilityID];
}

function clickTheThing() {
	// If we're going to be clicking, we should reset g_msTickRate
	// There's a reddit thread about why and we might as well be safe
	g_msTickRate = 1100;

	g_Minigame.m_CurrentScene.DoClick(
		{
			data: {
				getLocalPosition: function() {
					var enemy = g_Minigame.m_CurrentScene.GetEnemy(
						g_Minigame.m_CurrentScene.m_rgPlayerData.current_lane,
						g_Minigame.m_CurrentScene.m_rgPlayerData.target);
					var laneOffset = enemy.m_nLane * 440;

					return {
						x: enemy.m_Sprite.position.x - laneOffset,
						y: enemy.m_Sprite.position.y - 52
					}
				}
			}
		}
	);
	timer = timer - 1;
}

function startGoldRainClick() {
	var actions = g_Minigame.CurrentScene().m_rgActionLog;
	if(lastAction > actions.length){
		lastAction = actions.length;
	}
	
	if(actions.length > lastAction){
		for (var i = lastAction; i < actions.length; i++) {
			//console.log(actions[i].ability + " " + actions[i].type);
			if(actions[i].ability == 17 && actions[i].type == 'ability'){
				clearInterval(clickTimer);
				timer = 0;
				console.log('Let the GOLD rain!');
				clickTimer = window.setInterval(clickTheThing, 1000 / clickRate);
				timer = 150;
			}
		}
		lastAction = i;
	}
	
	if(timer <= 0){
		clearInterval(clickTimer);
		timer = 0;
	}
}

var thingTimer = window.setInterval(function(){
	if (g_Minigame && g_Minigame.CurrentScene().m_bRunning && g_Minigame.CurrentScene().m_rgPlayerTechTree) {
		window.clearInterval(thingTimer);
		firstRun();
		thingTimer = window.setInterval(doTheThing, 1000);
	}
}, 1000);
