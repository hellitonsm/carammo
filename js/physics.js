// ============================================================================
//  Physics — Ammo.js dynamics world initialization
// ============================================================================

import { CFG } from './config.js';
import { physicsWorld, setPhysicsWorld } from './state.js';

export function initPhysics() {
  const Ammo = window.Ammo;
  const cc = new Ammo.btDefaultCollisionConfiguration();
  const dp = new Ammo.btCollisionDispatcher(cc);
  const bp = new Ammo.btDbvtBroadphase();
  const sl = new Ammo.btSequentialImpulseConstraintSolver();
  const world = new Ammo.btDiscreteDynamicsWorld(dp, bp, sl, cc);
  world.setGravity(new Ammo.btVector3(0, -9.81, 0));
  setPhysicsWorld(world);
}
