import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, Mesh, MeshStandardMaterial, Plane, Raycaster, Vector3 } from "three";
import { configurePicking } from "../src/anatomy-rendering.ts";

test("structure picking excludes invisible, transparent, clipped and wrong-target surfaces", () => {
  const material = new MeshStandardMaterial();
  const mesh = new Mesh(new BoxGeometry(1,1,1), material);
  const ray = new Raycaster(new Vector3(0,0,2), new Vector3(0,0,-1));
  const hits = () => ray.intersectObject(mesh);
  configurePicking(mesh, "organ", "visible"); assert.ok(hits().length);
  material.clippingPlanes = [new Plane(new Vector3(0,0,-1), 0)]; assert.equal(hits().length,0);
  material.clippingPlanes = []; material.opacity = .01; assert.equal(hits().length,0);
  material.opacity = 1; mesh.visible = false; assert.equal(hits().length,0);
  mesh.visible = true; configurePicking(mesh, "organ", "skin"); assert.equal(hits().length,0);
  configurePicking(mesh, "skin", "internal"); assert.equal(hits().length,0);
  configurePicking(mesh, "skin", "skin"); assert.ok(hits().length);
  mesh.geometry.dispose(); material.dispose();
});
