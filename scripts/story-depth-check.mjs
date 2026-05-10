import { STORY_DEPTH_PACK, validateStoryDepthPack } from '../src/story/sifuDepthPack.js';

const result = validateStoryDepthPack();
console.log(`levels=${STORY_DEPTH_PACK.length}`);
if (!result.ok) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}
console.log('story-depth-pack:ok');
