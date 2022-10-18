import React, {useEffect, useRef} from 'react';
import * as THREE                 from 'three';

import styles                     from './StarrySky.module.css';

const r = 1000;
const FACTOR = 4;
const SPEED = .2;

// https://karthikkaranth.me/blog/generating-random-points-in-a-sphere/
function getPoint() {
  const u = Math.random();
  const v = Math.random();

  const theta = u * 2.0 * Math.PI;
  const phi = Math.acos(2.0 * v - 1.0);
  const r = Math.cbrt(Math.random());
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);

  const x = r * sinPhi * cosTheta;
  const y = r * sinPhi * sinTheta;
  const z = r * cosPhi;

  return {x, y, z};
}

function getRandomParticelPos(particleCount: number) {
  const arr = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const {x, y, z} = getPoint();

    arr[i + 0] = x * r;
    arr[i + 1] = y * r;
    arr[i + 2] = z * r;
  }

  return arr;
}

function resizeRendererToDisplaySize(renderer: THREE.Renderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height;

  if (needResize)
    renderer.setSize(width, height, false);

  return needResize;
}

function installSky(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
  const scene = new THREE.Scene();

  // light source
  const color = 0xffffff;
  const intensity = 1;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(-1, 2, 4);
  scene.add(light);

  // camera
  const fov = 75;
  const aspect = 2;
  const near = 1.5;
  const far = 10000;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

  // Geometry
  const geometrys = [
    new THREE.BufferGeometry(),
    new THREE.BufferGeometry(),
  ];

  geometrys[0].setAttribute(
    `position`,
    new THREE.BufferAttribute(getRandomParticelPos(350 * FACTOR), 3),
  );

  geometrys[1].setAttribute(
    `position`,
    new THREE.BufferAttribute(getRandomParticelPos(1500 * FACTOR), 3),
  );

  const loader = new THREE.TextureLoader();

  // material
  const materials = [
    new THREE.PointsMaterial({
      map: loader.load(`https://raw.githubusercontent.com/Kuntal-Das/textures/main/sp1.png`),
      alphaTest: 0.5,
      sizeAttenuation: true,
    }),
    new THREE.PointsMaterial({
      size: 1,
      map: loader.load(`https://raw.githubusercontent.com/Kuntal-Das/textures/main/sp2.png`),
      alphaTest: 0.5,
      sizeAttenuation: true,
    }),
  ];

  const container = new THREE.Object3D();
  scene.add(container);

  const starsT1 = new THREE.Points(geometrys[0], materials[0]);
  const starsT2 = new THREE.Points(geometrys[1], materials[1]);
  container.add(starsT1);
  container.add(starsT2);

  let timer: ReturnType<typeof requestAnimationFrame>;

  let lastTime: number | null = null;
  let aggregatedTime = 0;

  const render = (time: number) => {
    aggregatedTime += Math.min(time - (lastTime ?? time), 1000 / 60);
    lastTime = time;

    container.rotation.x = (aggregatedTime / 1000) * Math.PI / 80 * SPEED;
    container.rotation.y = (aggregatedTime / 1000) * Math.PI / 80 * SPEED;

    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
    timer = requestAnimationFrame(render);
  };

  timer = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(timer);
  };
}

export function StarrySky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return installSky(canvasRef.current!);
  }, []);

  return (
    <canvas className={styles.canvas} ref={canvasRef}/>
  );
}
