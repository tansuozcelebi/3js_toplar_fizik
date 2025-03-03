import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, useTexture } from '@react-three/drei';
import { Physics, useSphere, usePlane } from '@react-three/cannon';
import * as THREE from 'three';

function Ball({ position, color, transparent }) {
  const [ref, api] = useSphere(() => ({
    mass: 1,
    position,
    args: [0.5],
    material: { restitution: 0.8 }
  }));
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const { camera } = useThree();
  const sound = useRef();

  useEffect(() => {
    const listener = new THREE.AudioListener();
    ref.current?.add(listener);
    sound.current = new THREE.Audio(listener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('/bounce2.mp3', (buffer) => {
      sound.current.setBuffer(buffer);
      sound.current.setVolume(0.5);
    });

    return () => {
      if (ref.current) {
        ref.current.remove(listener);
      }
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
      castShadow
      receiveShadow
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => setClicked(true)}
    >
      <sphereGeometry args={[0.7, 32, 32]} />
      <meshStandardMaterial
        color={hovered ? 'red' : color}
        metalness={1}
        roughness={0.5}
       // transparent={transparent}
       // opacity={transparent ? 0.5 : 1}
      />
    </mesh>
  );
}

function Plane(props) {
  const texture = useTexture('/brick.jpg');
  const [ref] = usePlane(() => ({ rotation: [-Math.PI / 2, 0, 0], ...props }));
  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

function App() {
  const balls = Array.from({ length: 150 }, () => ({
    position: [Math.random() * 10 - 5, Math.random() * 150, Math.random() * 10 - 5],
    color: `hsl(${Math.random() * 360}, 100%, 50%)`,
    transparent: Math.random() > 0.1
  }));

  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 75 }} style={{ width: '100vw', height: '100vh' }} shadows>
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} castShadow />
      <Physics>
        {balls.map((props, i) => <Ball key={i} {...props} />)}
        <Plane position={[0, -10, 0]} />
      </Physics>
      <OrbitControls />
      <Environment files="/pretoria_gardens_4k.hdr" background />
    </Canvas>
  );
}

export default App;
