import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STORY_EXPERIENCE_VERSION,
  STORY_EXPERIENCE_BUILDING_CUES,
  createStoryExperienceState,
  resetStoryExperience,
  updateStoryExperience,
  consumeStoryExperienceCue,
  storyExperienceSnapshot,
} from '../src/campaignStoryExperience.js';

const root = process.cwd();
const main = readFileSync(join(root, 'src/main.js'), 'utf8');
const story = readFileSync(join(root, 'src/campaignStoryExperience.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'src/styles/game.css'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function requireSnippet(src, snippet, label) {
  assert(src.includes(snippet), `missing ${label}: ${snippet}`);
}

assert(STORY_EXPERIENCE_VERSION === 'story-experience.v1', 'unexpected story experience version');

for (const building of [1, 2, 3]) {
  const cues = STORY_EXPERIENCE_BUILDING_CUES[building];
  assert(cues && cues.deploy && cues.rooms && cues.objectives && cues.setpieces, `missing B0${building} cue set`);
  assert(Object.keys(cues.rooms).length >= 8, `B0${building} needs full room cue coverage`);
}

for (const roomId of [
  'b01_alarm_relay',
  'b01_relay_cage',
  'b02_alarm_relay',
  'b02_relay_cage',
  'b03_alarm_relay',
  'b03_relay_cage',
]) {
  requireSnippet(story, roomId, `authored cue room ${roomId}`);
}

for (const snippet of [
  "ctx.playMode === 'solo'",
  '!ctx.splitScreenActive',
  '!ctx.endlessMode',
  '!ctx.rangeActive',
  'STORY_EXPERIENCE_BUILDING_CUES[building]',
  'objectiveState.completedObjectiveIds?.disable_alarm_panel',
  'setpiece._relaySilenced',
  'director.lastTrigger',
]) {
  requireSnippet(story, snippet, 'story runtime guard');
}

for (const snippet of [
  "from './campaignStoryExperience.js'",
  'G.storyExperience=createStoryExperienceState()',
  'resetStoryExperience(G.storyExperience,_storyExperienceContext())',
  'updateStoryExperience(G.storyExperience,ctx)',
  'consumeStoryExperienceCue(G.storyExperience,ctx.nowMs)',
  "storyExperience:()=>storyExperienceSnapshot(G.storyExperience)",
  "storyExperience:G.storyExperience?storyExperienceSnapshot(G.storyExperience):null",
  "tickStoryExperience(dt)",
]) {
  requireSnippet(main, snippet, 'main story wiring');
}

for (const snippet of [
  'id="story-cue"',
  'id="story-cue-tag"',
  'id="story-cue-title"',
  'id="story-cue-body"',
  'id="mh-room"',
  'id="mh-task"',
]) {
  requireSnippet(html, snippet, 'story UI markup');
}

for (const snippet of [
  '#story-cue',
  '#story-cue.show',
  '@keyframes storyCueIn',
  '#mh-room,#mh-task',
]) {
  requireSnippet(css, snippet, 'story UI styles');
}

const level = { id: 'campaign-b01', name: 'Dock 7' };
const roomFlow = { rooms: { b01_alarm_relay: { name: 'Alarm Relay' } } };
const baseCtx = {
  started: true,
  playMode: 'solo',
  splitScreenActive: false,
  endlessMode: false,
  rangeActive: false,
  building: 1,
  campaignLevel: level,
  director: { currentFlowRoomId: null, lastTrigger: null, roomFlow },
  setpiece: null,
  boss: null,
  exitUnlocked: false,
  nowMs: 1000,
};

const state = createStoryExperienceState();
resetStoryExperience(state, baseCtx);
assert(state.enabled, 'story runtime should enable for solo B01');
assert(consumeStoryExperienceCue(state, 1000)?.kind === 'deploy', 'deploy cue did not promote');

updateStoryExperience(state, {
  ...baseCtx,
  nowMs: 5200,
  director: {
    currentFlowRoomId: 'b01_alarm_relay',
    lastTrigger: { type: 'reinforcement_queued', id: 'b01_alarm_pair', t: 1 },
    roomFlow,
  },
  setpiece: { active: true, kind: 'alarm', triggered: true, progress: 0, rewardGiven: false, _relaySilenced: false },
});
const roomCue = consumeStoryExperienceCue(state, 5200);
const snap = storyExperienceSnapshot(state);
assert(roomCue && roomCue.roomId === 'b01_alarm_relay', 'room cue did not promote after alarm relay entry');
assert(snap.hud && snap.hud.roomLabel === 'ALARM RELAY', 'story HUD did not expose room label');

const disabled = createStoryExperienceState();
resetStoryExperience(disabled, { ...baseCtx, splitScreenActive: true });
assert(!disabled.enabled, 'story runtime must stay disabled in split-screen');
resetStoryExperience(disabled, { ...baseCtx, rangeActive: true });
assert(!disabled.enabled, 'story runtime must stay disabled in range');

console.log(JSON.stringify({
  ok: true,
  version: STORY_EXPERIENCE_VERSION,
  buildings: Object.keys(STORY_EXPERIENCE_BUILDING_CUES).length,
  rooms: Object.fromEntries(Object.entries(STORY_EXPERIENCE_BUILDING_CUES).map(([k, v]) => [k, Object.keys(v.rooms).length])),
  promotedCue: roomCue.id,
  hud: snap.hud,
}, null, 2));
