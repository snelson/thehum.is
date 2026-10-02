// The page's script, as modules: the field loads first (its listeners first, as before), then the hum,
// then the way in. This wires the few calls that run the other way.
import { sound } from './field.js';
import { humTick, tapRedshift, tapRelease, TAP_CROSS, verse } from './hum.js';
import { landing } from './entrance.js';

Object.assign(sound, { humTick, tapRedshift, tapRelease, TAP_CROSS });
verse.landing = landing;
