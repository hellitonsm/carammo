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

  // Ground collision body — cars that fall off the track land here instead of void
  const groundShape = new Ammo.btBoxShape(new Ammo.btVector3(500, 0.5, 500));
  const groundTransform = new Ammo.btTransform(); groundTransform.setIdentity();
  groundTransform.setOrigin(new Ammo.btVector3(0, -2, 0));
  const groundBody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(
    0, new Ammo.btDefaultMotionState(groundTransform), groundShape, new Ammo.btVector3(0, 0, 0)));
  groundBody.setFriction(CFG.groundFriction);
  world.addRigidBody(groundBody);

  setPhysicsWorld(world);
}
