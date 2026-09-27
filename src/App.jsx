import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture, Stats, Environment } from '@react-three/drei';
import { Physics, useSphere, usePlane, useBox } from '@react-three/cannon';
import * as THREE from 'three';

// Tek bir listener ve tek bir ses buffer'ı tüm toplar arasında paylaşılır
let sharedListener = null;
let bounceBuffer = null;
function getListener(camera) {
  if (!sharedListener) {
    sharedListener = new THREE.AudioListener();
    camera.add(sharedListener);
    new THREE.AudioLoader().load('/bounce.mp3', (buffer) => {
      bounceBuffer = buffer;
    });
  }
  return sharedListener;
}

function Ball({ position, color }) {
  const { camera } = useThree();
  const sound = useRef();
  const hasBounced = useRef(false);

  const [ref, api] = useSphere(() => ({
    mass: 1,
    position,
    args: [0.5],
    material: { restitution: 0.8 },
    allowSleep: true,
    sleepSpeedLimit: 0.1,
    sleepTimeLimit: 1,
    // her top sadece ilk çarpmasında ses çıkarır
    onCollide: (e) => {
      const s = sound.current;
      if (hasBounced.current || !s || !bounceBuffer || e.contact.impactVelocity < 2) return;
      hasBounced.current = true;
      s.setBuffer(bounceBuffer);
      s.play();
    }
  }));
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    sound.current = new THREE.Audio(getListener(camera));
    sound.current.setVolume(0.15);
  }, [camera]);

  const handleClick = () => {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    api.wakeUp();
    api.velocity.set(direction.x * 10, direction.y * 10, direction.z * 10);
  };

  return (
    <mesh
      ref={ref}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={handleClick}
    >
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
      <torusGeometry args={[2.5, 0.5, 8, 32]} />
      <meshStandardMaterial color="gold" metalness={1} roughness={0.2} />
    </mesh>
  );
}

function App() {
  // rastgele başlangıç değerleri sadece bir kez üretilir
  const balls = useMemo(
    () =>
      Array.from({ length: 60 }, () => ({
        position: [Math.random() * 10 - 5, Math.random() * 150, Math.random() * 10 - 5],
        color: `hsl(${Math.random() * 360}, 100%, 50%)`
      })),
    []
  );

  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 75 }}
      style={{ width: '100vw', height: '100vh' }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.4} />
      <hemisphereLight args={['#ffffff', '#554433', 0.8]} />
      <directionalLight position={[10, 20, 10]} intensity={2} />
      <spotLight position={[-10, 15, 10]} angle={0.4} penumbra={1} intensity={150} />
      {/* metalik toplar için yansıma; HDR yüklenirken sahne beklemesin diye ayrı Suspense */}
      <Suspense fallback={null}>
        <Environment files="/pretoria_gardens_4k.hdr" />
      </Suspense>
      <Physics broadphase="SAP" allowSleep>
        {balls.map((props, i) => <Ball key={i} {...props} />)}
        <Plane position={[0, -10, 0]} />
        <Torus />
      </Physics>
      <OrbitControls />
      <Stats />
    </Canvas>
  );
}

export default App;
