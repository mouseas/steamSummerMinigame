var isAlreadyRunning = false;

function doTheThing() {
	if (isAlreadyRunning || g_Minigame === undefined) {
		return;
	}
	isAlreadyRunning = true;
	
	goToLaneWithBestTarget();
	
	useGoodLuckCharmIfRelevant();
	useMedicsIfRelevant();
	
	// TODO use abilities if available and a suitable target exists
	// - Tactical Nuke on a Spawner if below 50% and above 25% of its health
	// - Cluster Bomb and Napalm if the current lane has a spawner and 2+ creeps
	// - Metal Detector if a spawner death is imminent (predicted in > 2 and < 7 seconds)
	// - Morale Booster if available and lane has > 2 live enemies
	// - Decrease Cooldowns if another player used a long-cooldown ability < 10 seconds ago
	
	// TODO purchase abilities and upgrades intelligently
	
	attemptRespawn();
	
	
	
	isAlreadyRunning = false;
}

function goToLaneWithBestTarget() {
	var targetFound = false;
	var lowHP = 0;
	var lowLane = 0;
	var lowTarget = 0;
	
	// determine which lane and enemy is the optimal target
	var enemyTypePriority = [4, 2, 3, 0, 1];
	for (var k = 0; !targetFound && k < enemyTypePriority.length; k++) {
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
				if(lowHP < 1 || enemies[i].m_flDisplayedHP < lowHP) {
					targetFound = true;
					lowHP = enemies[i].m_flDisplayedHP;
					lowLane = enemies[i].m_nLane;
					lowTarget = enemies[i].m_nID;
				}
			}
		}
	}
	
	// TODO maybe: Prefer lane with a dying creep as long as all living spawners have >50% health
	
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
	if (hasAbility(7)) {
		// each bit in unlocked_abilities_bitfield corresponds to an ability. Medics is ability 7.
		// the above condition checks if the Medics bit is set or cleared. I.e. it checks if
		// the player has the Medics ability.

		if (hasCooldown(7)) {
			return;
		}

		// Medics is purchased, cooled down, and needed. Trigger it.
		console.log('Medics is purchased, cooled down, and needed. Trigger it.');
		if (document.getElementById('ability_7')) {
			g_Minigame.CurrentScene().TryAbility(document.getElementById('ability_7').childElements()[0]);
		}
	}
}

// Use Good Luck Charm if doable
function useGoodLuckCharmIfRelevant() {
	// check if Good Luck Charms is purchased and cooled down
	if (hasAbility(6)) {
		if (hasCooldown(6)) {
			return;
		}

		// Good Luck Charms is purchased, cooled down, and needed. Trigger it.
		console.log('Good Luck Charms is purchased, cooled down, and needed. Trigger it.');
		if (document.getElementById('ability_6')) {
			g_Minigame.CurrentScene().TryAbility(document.getElementById('ability_6').childElements()[0]);
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

function hasCooldown(abilityId) {
	return g_Minigame.CurrentScene().GetCooldownForAbility(abilityId) > 0;
}

function hasAbility(abilityId) {
	return g_Minigame.CurrentScene().bHaveAbility(abilityId) > 0;
}

var thingTimer = window.setInterval(doTheThing, 1000);
