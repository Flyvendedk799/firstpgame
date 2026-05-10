import { DEPLOY_STORY_LEVELS, validateDeployStoryLevels } from '../src/story/levels.js';
import { STORY_DEPTH_PACK, validateStoryDepthPack } from '../src/story/sifuDepthPack.js';
import {
  DEPLOY_ONLY_LEVEL_MANIFEST,
  assertNoTestStoryContamination
} from '../src/story/deployManifest.js';

const schema = validateDeployStoryLevels();
const depth = validateStoryDepthPack();
const contamination = assertNoTestStoryContamination({
  DEPLOY_STORY_LEVELS,
  STORY_DEPTH_PACK: STORY_DEPTH_PACK.map((item) => ({ levelId: item.levelId }))
});

const snapshot = {
  ids: DEPLOY_ONLY_LEVEL_MANIFEST,
  routeLayers: STORY_DEPTH_PACK.map((item) => ({
    levelId: item.levelId,
    routeLayerCount: Object.keys(item.routeLayers).length,
    encounterCount: item.encounterScript.length
  }))
};

console.log(JSON.stringify(snapshot, null, 2));

const errors = [...schema.errors, ...depth.errors, ...contamination.errors];
if (errors.length) {
  console.error('\nDeploy story validation failed:');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log('\nDeploy story validation passed.');
