import { animationFeatureFlags, getWeaponAnimationProfile, PLAYER_LOCOMOTION_STATES } from './profiles.js';
import { createAnimationChannelState, beginAnimationFrame, claimAnimationChannel, animationChannelReport } from './channels.js';
import { normalizeNotifyList } from './notifies.js';

export function createAnimationGraphState(options = {}) {
  return {
    version: 1,
    frame: 0,
    flags: animationFeatureFlags(options.settings || {}),
    channels: createAnimationChannelState(),
    activeStates: {
      locomotion: 'idle',
      weapon: 'hip',
      enemy: 'idle',
      editorPreview: 'none'
    },
    lastNotifies: []
  };
}

export function resolveLocomotionState(movement = {}) {
  if (movement.dropkickActive || movement.dropkick) return 'dropkick';
  if (movement.wallJumpTimer > 0 || movement.wallJump) return 'wallJump';
  if (movement.vaulting || movement.vault) return 'vault';
  if (movement.sliding || movement.slide > 0.2) return 'slide';
  if (movement.grounded === false || movement.fall > 0.25) return 'fallLoop';
  if (movement.land > 0.45) return movement.land > 0.78 ? 'landHeavy' : 'landLight';
  if (movement.crouch > 0.25 || movement.crouching) return movement.speed > 0.15 ? 'crouchWalk' : 'crouchIdle';
  if (movement.sprint > 0.45 || movement.running) return 'sprint';
  if (movement.speed > 2.4) return 'jog';
  if (movement.speed > 0.15) return movement.forward < -0.25 ? 'backpedal' : (Math.abs(movement.strafe || 0) > 0.25 ? 'strafe' : 'walk');
  return 'idle';
}

export function updateAnimationGraphState(graph, input = {}) {
  const g = graph || createAnimationGraphState(input);
  g.frame = Number(input.frame) || (g.frame + 1);
  g.flags = animationFeatureFlags(input.settings || g.flags || {});
  beginAnimationFrame(g.channels, g.frame);

  const locomotion = resolveLocomotionState(input.movement || {});
  const weaponProfile = getWeaponAnimationProfile(input.weaponType || input.weaponIdx);
  const weapon = input.reloading ? 'reload'
    : input.weaponState || (input.ads > 0.5 ? 'ads' : input.sprint > 0.35 ? 'sprintLow' : 'hip');
  const enemy = input.enemyState || 'idle';
  g.activeStates = { locomotion, weapon, enemy, editorPreview: input.editorPreview || 'none' };

  claimAnimationChannel(g.channels, 'body', `locomotion:${locomotion}`);
  claimAnimationChannel(g.channels, 'weapon', `weapon:${weaponProfile.type}:${weapon}`);
  claimAnimationChannel(g.channels, 'hands', `hands:${weaponProfile.type}`);
  claimAnimationChannel(g.channels, 'camera', `camera:${locomotion}`);
  if (enemy !== 'idle') claimAnimationChannel(g.channels, 'enemy', `enemy:${enemy}`);

  g.lastNotifies = normalizeNotifyList(input.notifies || []).slice(-16);
  return g;
}

export function animationGraphDebug(graph) {
  const g = graph || createAnimationGraphState();
  return {
    version: g.version || 1,
    frame: g.frame || 0,
    flags: { ...(g.flags || {}) },
    activeStates: { ...(g.activeStates || {}) },
    knownLocomotionStates: PLAYER_LOCOMOTION_STATES.slice(),
    notifies: g.lastNotifies || [],
    channels: animationChannelReport(g.channels)
  };
}
