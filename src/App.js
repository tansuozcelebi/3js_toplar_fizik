import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import { Physics, useSphere, usePlane, useBox } from '@react-three/cannon';
import * as THREE from 'three';
import Stats from 'stats.js';

function Ball({ position, color, transparent }) {
  const [ref, api] = useSphere(() => ({
    mass: 1,
    position,
    args: [0.5],
    material: { restitution: 0.8 },
    allowSleep: true,
    sleepSpeedLimit: 0.1,
    sleepTimeLimit: 1
  }));
  // enable sleeping to skip physics for inactive balls
  // note: cannon body sleep properties are passed through useSphere
  // we'll re-create ref with sleep options below
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const { camera } = useThree();
  const sound = useRef();

  useEffect(() => {
  const listener = new THREE.AudioListener();
  const node = ref.current;
  if (node) node.add(listener);
  sound.current = new THREE.Audio(listener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('/bounce2.mp3', (buffer) => {
      sound.current.setBuffer(buffer);
      sound.current.setVolume(0.5);
    });

    return () => {
      if (node) node.remove(listener);
    };
  }, [ref]);

  useFrame(() => {
    api.velocity.subscribe((velocity) => {
      if (velocity.some((v) => Math.abs(v) > 0.1)) {
        if (sound.current.isPlaying) sound.current.stop();
        sound.current.play();
      }
    });

    if (clicked) {
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      api.velocity.set(direction.x * 10, direction.y * 10, direction.z * 10); // Hızı artırdık
      setClicked(false);
    }
  });

  return (
    <mesh
  ref={ref}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => setClicked(true)}
    >
  {/* lower geometry detail for performance */}
  <sphereGeometry args={[0.7, 12, 12]} />
      <meshStandardMaterial
        color={hovered ? 'red' : color}
        metalness={1}
        roughness={0.5}
      />
    </mesh>
  );
}

function Plane(props) {
  const texture = useTexture('/brick.jpg');
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3); // Dokunun boyutunu 1/3 oranında küçültmek için

  const [ref] = usePlane(() => ({ rotation: [-Math.PI / 2, 0, 0], ...props }));
  return (
    <mesh ref={ref}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

function Torus() {
  const [ref] = useBox(() => ({
    mass: 0,
    position: [0, -5, 0],
    args: [2.5, 0.5, 2.5],
    rotation: [Math.PI / 2, 0, 0]
  }));

  useFrame(() => {
    ref.current.rotation.x += 0.01;
    ref.current.rotation.y += 0.02;
    ref.current.rotation.z += 0.03;
  });

  return (
    <mesh ref={ref}>
      {/* lower torus detail */}
      <torusGeometry args={[2.5, 0.5, 8, 32]} />
      <meshStandardMaterial color="gold" metalness={1} roughness={0.2} />
    </mesh>
  );
}

function App() {
  // reduce the number of balls to improve performance
  const balls = Array.from({ length: 60 }, () => ({
    position: [Math.random() * 10 - 5, Math.random() * 150, Math.random() * 10 - 5],
    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
    transparent: Math.random() > 0.1
  }));

  const stats = useRef();

  useEffect(() => {
    stats.current = new Stats();
    stats.current.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.current.dom);

    const animate = () => {
      stats.current.begin();
      stats.current.end();
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);

    return () => {
      document.body.removeChild(stats.current.dom);
    };
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 75 }}
      style={{ width: '100vw', height: '100vh' }}
      gl={{ antialias: false, powerPreference: 'low-power' }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} />
      <Physics>
        {balls.map((props, i) => <Ball key={i} {...props} />)}
        <Plane position={[0, -10, 0]} />
        <Torus />
      </Physics>
  <OrbitControls />
    </Canvas>
  );
}

export default App;
