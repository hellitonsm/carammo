import { setPhysicsWorld, getPhysicsWorld } from './state.js';

export function initPhysics() {
  const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  const world = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration
  );
  world.setGravity(new Ammo.btVector3(0, -9.81, 0));
  setPhysicsWorld(world);
  return world;
}

export function stepPhysics(dt) {
  const world = getPhysicsWorld();
  if (world) world.stepSimulation(dt, 4, 1 / 120);
}
