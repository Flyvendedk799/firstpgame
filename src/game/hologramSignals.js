export const HOLOGRAM_SIGNAL_VERSION = 'hologram-signal.v1';

function clamp01(v) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function decay(v, speed, dt) {
  const k = Math.exp(-Math.max(0, speed) * Math.max(0, dt || 0));
  return clamp01((Number.isFinite(v) ? v : 0) * k);
}

function pulseMax(current, next) {
  return Math.max(clamp01(current), clamp01(next));
}

export function createHologramSignalState() {
  return {
    version: HOLOGRAM_SIGNAL_VERSION,
    initialized: false,
    lastHp: 100,
    lastAmmo: 0,
    lastAmmoRes: 0,
    lastMag: 1,
    lastMoney: 0,
    lastHealPacks: 0,
    lastGrenades: 0,
    lastWeaponIdx: -1,
    lastReloading: false,
    lastReloadPhase: 'idle',
    lastInventoryOpen: false,
    lastShopOpen: false,
    damagePulse: 0,
    healPulse: 0,
    shotPulse: 0,
    ammoGainPulse: 0,
    lowAmmoPulse: 0,
    criticalAmmoPulse: 0,
    reloadPulse: 0,
    reloadPhasePulse: 0,
    economyPulse: 0,
    purchasePulse: 0,
    resourcePulse: 0,
    inventoryPulse: 0,
    shopPulse: 0,
    weaponSwapPulse: 0,
    warningPulse: 0,
    signalNoise: 0,
    signalIntegrity: 1,
    ammoRatio: 1,
    lowAmmo: false,
    criticalAmmo: false,
    eventLabel: 'NOMINAL',
    statusLabel: 'READY',
    lastEventAtMs: 0
  };
}

export function tickHologramSignals(state, player, opts = {}) {
  const s = state || createHologramSignalState();
  const dt = Math.max(0, opts.dt || 0);
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
  const weapon = opts.weapon || {};
  const magCandidates = [
    weapon.mag,
    opts.mag,
    player?._magSize,
    player?._lastMagSize,
    player?._reloadFeelSnapshot?.mag,
    state?.lastMag
  ];
  const mag = Math.max(1, magCandidates.find(Number.isFinite) || 1);
  const hp = Number.isFinite(player?.hp) ? player.hp : s.lastHp;
  const ammo = Number.isFinite(player?.ammo) ? player.ammo : s.lastAmmo;
  const ammoRes = Number.isFinite(player?.ammoRes) ? player.ammoRes : s.lastAmmoRes;
  const money = Number.isFinite(player?.money) ? player.money : s.lastMoney;
  const healPacks = Number.isFinite(player?.healPacks) ? player.healPacks : s.lastHealPacks;
  const grenades = Number.isFinite(player?.grenades) ? player.grenades : s.lastGrenades;
  const weaponIdx = Number.isFinite(player?.weaponIdx) ? player.weaponIdx | 0 : s.lastWeaponIdx;
  const reloading = !!player?.reloading;
  const reloadPhase = opts.reloadPhase || (reloading ? 'reload' : 'idle');
  const inventoryOpen = !!opts.inventoryOpen;
  const shopOpen = !!opts.shopOpen;

  s.damagePulse = decay(s.damagePulse, 4.8, dt);
  s.healPulse = decay(s.healPulse, 4.2, dt);
  s.shotPulse = decay(s.shotPulse, 9.5, dt);
  s.ammoGainPulse = decay(s.ammoGainPulse, 5.2, dt);
  s.lowAmmoPulse = decay(s.lowAmmoPulse, 2.4, dt);
  s.criticalAmmoPulse = decay(s.criticalAmmoPulse, 2.0, dt);
  s.reloadPulse = decay(s.reloadPulse, 3.0, dt);
  s.reloadPhasePulse = decay(s.reloadPhasePulse, 6.4, dt);
  s.economyPulse = decay(s.economyPulse, 4.2, dt);
  s.purchasePulse = decay(s.purchasePulse, 4.8, dt);
  s.resourcePulse = decay(s.resourcePulse, 4.4, dt);
  s.inventoryPulse = decay(s.inventoryPulse, 5.8, dt);
  s.shopPulse = decay(s.shopPulse, 5.8, dt);
  s.weaponSwapPulse = decay(s.weaponSwapPulse, 5.4, dt);
  s.warningPulse = decay(s.warningPulse, 3.2, dt);

  if (!s.initialized) {
    s.initialized = true;
    s.lastHp = hp;
    s.lastAmmo = ammo;
    s.lastAmmoRes = ammoRes;
    s.lastMag = mag;
    s.lastMoney = money;
    s.lastHealPacks = healPacks;
    s.lastGrenades = grenades;
    s.lastWeaponIdx = weaponIdx;
    s.lastReloading = reloading;
    s.lastReloadPhase = reloadPhase;
    s.lastInventoryOpen = inventoryOpen;
    s.lastShopOpen = shopOpen;
  } else {
    const hpDelta = hp - s.lastHp;
    const ammoDelta = ammo - s.lastAmmo;
    const moneyDelta = money - s.lastMoney;
    const resourceDelta = Math.abs(healPacks - s.lastHealPacks) + Math.abs(grenades - s.lastGrenades);
    if (hpDelta < 0) {
      s.damagePulse = pulseMax(s.damagePulse, Math.min(1, Math.abs(hpDelta) / 34 + 0.18));
      s.warningPulse = pulseMax(s.warningPulse, Math.min(1, Math.abs(hpDelta) / 45 + 0.12));
      s.eventLabel = 'BIO HIT';
      s.lastEventAtMs = nowMs;
    } else if (hpDelta > 0) {
      s.healPulse = pulseMax(s.healPulse, Math.min(1, hpDelta / 35 + 0.18));
      s.eventLabel = 'BIO STABLE';
      s.lastEventAtMs = nowMs;
    }
    if (ammoDelta < 0 && !reloading) {
      s.shotPulse = pulseMax(s.shotPulse, Math.min(1, Math.abs(ammoDelta) / 6 + 0.18));
      s.eventLabel = ammo <= 0 ? 'MAG EMPTY' : 'ROUND OUT';
      s.lastEventAtMs = nowMs;
    } else if (ammoDelta > 0) {
      s.ammoGainPulse = pulseMax(s.ammoGainPulse, Math.min(1, ammoDelta / Math.max(1, mag) + 0.24));
      s.eventLabel = reloading ? 'MAG SEATED' : 'AMMO SYNC';
      s.lastEventAtMs = nowMs;
    }
    if (moneyDelta !== 0) {
      const p = Math.min(1, Math.abs(moneyDelta) / 180 + 0.22);
      s.economyPulse = pulseMax(s.economyPulse, p);
      if (moneyDelta < 0) s.purchasePulse = pulseMax(s.purchasePulse, p);
      s.eventLabel = moneyDelta < 0 ? 'PURCHASE' : 'CREDIT IN';
      s.lastEventAtMs = nowMs;
    }
    if (resourceDelta > 0) {
      s.resourcePulse = pulseMax(s.resourcePulse, Math.min(1, resourceDelta * 0.34 + 0.18));
      s.eventLabel = 'KIT SYNC';
      s.lastEventAtMs = nowMs;
    }
    if (weaponIdx !== s.lastWeaponIdx) {
      s.weaponSwapPulse = pulseMax(s.weaponSwapPulse, 0.92);
      s.eventLabel = 'WEAPON LINK';
      s.lastEventAtMs = nowMs;
    }
    if (reloading !== s.lastReloading) {
      s.reloadPulse = pulseMax(s.reloadPulse, reloading ? 0.95 : 0.70);
      s.eventLabel = reloading ? 'RELOAD START' : 'RELOAD END';
      s.lastEventAtMs = nowMs;
    }
    if (reloadPhase !== s.lastReloadPhase) {
      s.reloadPhasePulse = pulseMax(s.reloadPhasePulse, 0.82);
      if (reloading) {
        s.eventLabel = `PHASE ${String(reloadPhase).toUpperCase()}`;
        s.lastEventAtMs = nowMs;
      }
    }
    if (inventoryOpen !== s.lastInventoryOpen) s.inventoryPulse = pulseMax(s.inventoryPulse, inventoryOpen ? 0.80 : 0.48);
    if (shopOpen !== s.lastShopOpen) s.shopPulse = pulseMax(s.shopPulse, shopOpen ? 0.80 : 0.48);
  }

  s.ammoRatio = clamp01(ammo / mag);
  s.lowAmmo = s.ammoRatio <= (opts.lowAmmoThreshold ?? 0.25) && weaponIdx !== 2;
  s.criticalAmmo = s.ammoRatio <= (opts.criticalAmmoThreshold ?? 0.08) && weaponIdx !== 2;
  if (s.lowAmmo) s.lowAmmoPulse = pulseMax(s.lowAmmoPulse, s.criticalAmmo ? 0.78 : 0.44);
  if (s.criticalAmmo) {
    s.criticalAmmoPulse = pulseMax(s.criticalAmmoPulse, 0.86);
    s.warningPulse = pulseMax(s.warningPulse, 0.55);
  }

  const stress = clamp01(
    s.damagePulse * 0.55 +
    s.warningPulse * 0.34 +
    s.criticalAmmoPulse * 0.28 +
    (reloading ? 0.14 : 0) +
    (player?._nearMissPulse || 0) * 0.18 +
    (player?._enemyShotPressure || 0) * 0.14
  );
  s.signalNoise = clamp01(stress + s.reloadPhasePulse * 0.12 + s.weaponSwapPulse * 0.10);
  s.signalIntegrity = clamp01(1 - stress * 0.42);
  s.statusLabel = s.criticalAmmo ? 'CRITICAL AMMO' : s.lowAmmo ? 'LOW AMMO' : reloading ? String(reloadPhase).toUpperCase() : hp < 35 ? 'BIO WARNING' : 'READY';
  if (nowMs - (s.lastEventAtMs || 0) > 2200) s.eventLabel = s.statusLabel;

  s.lastHp = hp;
  s.lastAmmo = ammo;
  s.lastAmmoRes = ammoRes;
  s.lastMag = mag;
  s.lastMoney = money;
  s.lastHealPacks = healPacks;
  s.lastGrenades = grenades;
  s.lastWeaponIdx = weaponIdx;
  s.lastReloading = reloading;
  s.lastReloadPhase = reloadPhase;
  s.lastInventoryOpen = inventoryOpen;
  s.lastShopOpen = shopOpen;
  return s;
}

export function hologramSignalSnapshot(state) {
  const s = state || createHologramSignalState();
  return {
    version: HOLOGRAM_SIGNAL_VERSION,
    integrity: Number((s.signalIntegrity || 0).toFixed(3)),
    noise: Number((s.signalNoise || 0).toFixed(3)),
    ammoRatio: Number((s.ammoRatio || 0).toFixed(3)),
    lowAmmo: !!s.lowAmmo,
    criticalAmmo: !!s.criticalAmmo,
    statusLabel: s.statusLabel || 'READY',
    eventLabel: s.eventLabel || 'NOMINAL',
    pulses: {
      damage: Number((s.damagePulse || 0).toFixed(3)),
      shot: Number((s.shotPulse || 0).toFixed(3)),
      reload: Number((s.reloadPulse || 0).toFixed(3)),
      reloadPhase: Number((s.reloadPhasePulse || 0).toFixed(3)),
      economy: Number((s.economyPulse || 0).toFixed(3)),
      warning: Number((s.warningPulse || 0).toFixed(3))
    }
  };
}
