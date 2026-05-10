import { STORY_LEVELS } from './levels.js';
import { STORY_DEPTH_PACK } from './sifuDepthPack.js';

const DEPLOY_ID_RE = /^L(0[1-9]|1[0-2])_/;

export const DEPLOY_ONLY_LEVEL_MANIFEST = Object.freeze(
  STORY_LEVELS.filter((level) => DEPLOY_ID_RE.test(level.id)).map((level) => level.id)
);

export function isDeployLevelId(id) {
  return DEPLOY_ID_RE.test(id);
}

export function filterDeployLevels(levels) {
  return levels.filter((level) => isDeployLevelId(level.id));
}

export function assertNoTestStoryContamination(collections = {}) {
  const errors = [];
  for (const [name, records] of Object.entries(collections)) {
    for (const record of records ?? []) {
      const id = record?.id ?? record?.levelId ?? '';
      if (!id) {
        errors.push(`${name}: missing id/levelId`);
        continue;
      }
      if (!isDeployLevelId(id)) {
        errors.push(`${name}: non-deploy id found (${id})`);
      }
    }
  }

  const depthMismatch = STORY_DEPTH_PACK
    .map((item) => item.levelId)
    .filter((id) => !DEPLOY_ONLY_LEVEL_MANIFEST.includes(id));
  for (const id of depthMismatch) {
    errors.push(`STORY_DEPTH_PACK: non-deploy id found (${id})`);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
