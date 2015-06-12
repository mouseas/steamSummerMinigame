var isAlreadyRunning = false;
var myMaxHealth = 0;

function doTheThing() {
	if (isAlreadyRunning || g_Minigame === undefined) {
		return;
	}
	isAlreadyRunning = true;
	
	goToLaneWithLowest();
	
	useMedicsIfRelevant();
	
	// TODO use abilities if available and a suitable target exists
	// - Tactical Nuke on a Spawner if below 50% and above 25% of its health
	// - Cluster Bomb and Napalm if the current lane has a spawner and 2+ creeps
	// - Good Luck if available
	// - Metal Detector if a spawner death is imminent (predicted in > 2 and < 7 seconds)
	// - Morale Booster if available and lane has > 2 live enemies
	// - Decrease Cooldowns if another player used a long-cooldown ability < 10 seconds ago
	
	// TODO purchase abilities and upgrades intelligently
	
	attemptRespawn();
	
	isAlreadyRunning = false;
}

function goToLaneWithLowest() {		
	// TODO prefer lane with a dying creep as long as all living spawners have >50% health

	var bosses = findEnemies('boss');
	if (targetWeakestEnemy(bosses))
		return;

	// if no boss, find the weakest miniboss
	var minibosses = findEnemies('miniboss');
	if (targetWeakestEnemy(minibosses))
		return;

	
	// determine which living spawner has lowest hp
	var spawners = findEnemies('spawner');
	if (targetWeakestEnemy(spawners))
		return;
	
	// determine which living creep has the lowest hp
	var creeps = findEnemies('creep');
	targetWeakestEnemy(creeps);

}

function useMedicsIfRelevant() {

	myMaxHealth = g_Minigame.CurrentScene().m_rgPlayerTechTree.max_hp;
	
	// check if health is below 50%
	var hpPercent = g_Minigame.CurrentScene().m_rgPlayerData.hp / myMaxHealth;

	if (hpPercent > 0.5 || g_Minigame.CurrentScene().m_rgPlayerData.hp < 1) {
		return; // no need to heal - HP is above 50% or already dead
	}
	
	// check if Medics is purchased and cooled down
	if ((1 << 7) & g_Minigame.CurrentScene().m_rgPlayerTechTree.unlocked_abilities_bitfield) {
		// each bit in unlocked_abilities_bitfield corresponds to an ability. Medics is ability 7.
		// the above condition checks if the Medics bit is set or cleared. I.e. it checks if
		// the player has the Medics ability.
		
		var abilitiesInCooldown = g_Minigame.CurrentScene().m_rgPlayerData.active_abilities;
		for (var i = 1; i < abilitiesInCooldown.length; i++) {
			if (abilitiesInCooldown[i].ability == 7) {
				return; // Medics is in cooldown, can't use it.
			}
		}
		
		// Medics is purchased, cooled down, and needed. Trigger it.
		console.log('Medics is purchased, cooled down, and needed. Trigger it.');
		if (document.getElementById('ability_7')) {
			g_Minigame.CurrentScene().TryAbility(document.getElementById('ability_7').childElements()[0]);
		}
	}
}

//If respawn button is available, call respawn method
function attemptRespawn() {
   if (document.getElementById('player_respawn_btn')) {
		RespawnPlayer();
	}
}

var thingTimer = window.setInterval(doTheThing, 1000);

// helpers

function enemyTypeFinder(enemy) {
	switch (enemy.m_data.type) {
		case 0:
			return 'spawner';
		case 1:
			return 'creep';
		case 2:
			return 'boss';
		case 3:
			return 'miniboss';
	}
}

function switchLanes(newLane) {
	// switches only if it's not our current
	if (g_Minigame.CurrentScene().m_nExpectedLane != newLane) {
		//console.log('switching lanes');
		g_Minigame.CurrentScene().TryChangeLane(newLane);
	}
}
function switchTargets(newTarget) {
	// target the chosen enemy
	// switches only if it's not our current
	if (g_Minigame.CurrentScene().m_nTarget != newTarget) {
		//console.log('switching targets');
		g_Minigame.CurrentScene().TryChangeTarget(newTarget);
	}
}

function findEnemies(type) {
	var enemies = [];
	for (var i = 0; i < 3; i++) {
		for (var j = 0; j < 4; j++) {
			var enemy = g_Minigame.CurrentScene().GetEnemy(i, j);
			if (enemy && enemyTypeFinder(enemy) == type) {
				enemies[enemies.length] = g_Minigame.CurrentScene().GetEnemy(i, j);
			}
		}
	}
	return enemies;
}

function targetWeakestEnemy(enemyList) {
	var targetFound = false;
	var lowLane;
	var lowTarget;
	var lowHP = 0;

	for (var i = 0; i < enemyList.length; i++) {
		if (enemyList[i] && !enemyList[i].m_bIsDestroyed) {
			if(lowHP < 1 || enemyList[i].m_flDisplayedHP < lowHP) {
				targetFound = true;
				lowHP = enemyList[i].m_flDisplayedHP;
				lowLane = enemyList[i].m_nLane;
				lowTarget = enemyList[i].m_nID;
			}
		}
	}

	if (targetFound) {
		switchLanes(lowLane);
		switchTargets(lowTarget);
	}

	return targetFound;

}