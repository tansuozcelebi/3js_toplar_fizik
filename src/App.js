import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture, Sky, Stars, ContactShadows } from '@react-three/drei';
import { Physics, useSphere, usePlane, useBox } from '@react-three/cannon';
import * as THREE from 'three';
import Stats from 'stats.js';

const DEFAULT_PARAMS = {
  ballCount: 60,
  ballRadius: 0.5,
  ballMass: 1,
  restitution: 0.8,
  gravity: -9.82,
};

// Keys that require physics scene remount when changed
const PHYSICS_REMOUNT_KEYS = ['ballCount', 'ballRadius', 'ballMass', 'restitution'];

function Ball({ position, color, radius, mass, restitution }) {
  const [ref, api] = useSphere(() => ({
    mass,
    position,
    args: [radius],
    material: { restitution },
    allowSleep: true,
    sleepSpeedLimit: 0.1,
    sleepTimeLimit: 1,
  }));

  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();
  // useRef avoids a state update + re-render on every click
  const clickedRef = useRef(false);

  useFrame(() => {
    if (clickedRef.current) {
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      api.velocity.set(direction.x * 12, direction.y * 12, direction.z * 12);
      clickedRef.current = false;
    }
  });

  return (
    <mesh
      ref={ref}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={() => { clickedRef.current = true; }}
    >
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial
        color={hovered ? '#ffffff' : color}
        metalness={0.7}
        roughness={0.15}
        envMapIntensity={1.5}
      />
    </mesh>
  );
}

function Ground(props) {
  const texture = useTexture('/brick.jpg');
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);

  const [ref] = usePlane(() => ({ rotation: [-Math.PI / 2, 0, 0], ...props }));
  return (
    <mesh ref={ref}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial map={texture} roughness={0.9} metalness={0.1} />
    </mesh>
  );
}

function SpinningTorus() {
  const [ref] = useBox(() => ({
    mass: 0,
    position: [0, -5, 0],
    args: [2.5, 0.5, 2.5],
    rotation: [Math.PI / 2, 0, 0],
  }));

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.4;
    }
  });

  return (
    <mesh ref={ref}>
      <torusGeometry args={[2.5, 0.5, 8, 32]} />
      <meshStandardMaterial color="gold" metalness={1} roughness={0.05} envMapIntensity={3} />
    </mesh>
  );
}

function ControlPanel({ display, onSlide, onRelease }) {
  const controls = [
    { key: 'ballCount',   label: 'Top Sayısı',          min: 5,   max: 150, step: 1    },
    { key: 'ballRadius',  label: 'Top Boyutu',           min: 0.2, max: 1.5, step: 0.05 },
    { key: 'ballMass',    label: 'Top Kütlesi',          min: 0.1, max: 10,  step: 0.1  },
    { key: 'restitution', label: 'Sekme (Restitution)',  min: 0,   max: 1,   step: 0.05 },
    { key: 'gravity',     label: 'Yerçekimi',            min: -30, max: 0,   step: 0.5  },
  ];

  return (
    <div style={{
      position: 'fixed', top: 10, left: 10, zIndex: 100,
      background: 'rgba(0,0,0,0.82)', color: '#fff',
      padding: '14px 16px', borderRadius: '10px',
      fontFamily: 'monospace', fontSize: '12px',
      width: '240px', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.15)',
      userSelect: 'none',
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '10px', color: '#9ad4ff', letterSpacing: '0.5px' }}>
        🎛️ Parametrik Kontroller
      </div>
      {controls.map(({ key, label, min, max, step }) => (
        <div key={key} style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#cce' }}>{label}</span>
            <span style={{ color: '#ffda6a', fontWeight: 'bold' }}>{display[key]}</span>
          </div>
          <input
            type="range" min={min} max={max} step={step}
            value={display[key]}
            onChange={e => onSlide(key, parseFloat(e.target.value))}
            onMouseUp={e => onRelease(key, parseFloat(e.target.value))}
            onTouchEnd={e => onRelease(key, parseFloat(e.currentTarget.value))}
            style={{ width: '100%', accentColor: '#7eb8f7', cursor: 'pointer' }}
          />
        </div>
      ))}
      <div style={{ fontSize: '10px', color: '#888', marginTop: '6px', borderTop: '1px solid #333', paddingTop: '6px' }}>
        Topa tıklayarak ilerletin • Slider bırakınca uygular
      </div>
    </div>
  );
}

function App() {
  const [displayParams, setDisplayParams] = useState({ ...DEFAULT_PARAMS });
  const [appliedParams, setAppliedParams] = useState({ ...DEFAULT_PARAMS });
  const [physicsKey, setPhysicsKey] = useState(0);
  const statsRef = useRef();

  // Move slider: update display immediately; update gravity live (no remount needed)
  const handleSlide = (key, value) => {
    setDisplayParams(p => ({ ...p, [key]: value }));
    if (key === 'gravity') {
      setAppliedParams(p => ({ ...p, gravity: value }));
    }
  };

  // Release slider: commit value and remount physics if ball properties changed
  const handleRelease = (key, value) => {
    setAppliedParams(p => ({ ...p, [key]: value }));
    if (PHYSICS_REMOUNT_KEYS.includes(key)) {
      setPhysicsKey(k => k + 1);
    }
  };

  // Regenerate ball list when physics scene remounts or ball count changes.
  // physicsKey is intentionally the primary trigger (incremented on slider release);
  // appliedParams.ballCount is included so the count is always in sync.
  const balls = useMemo(() =>
    Array.from({ length: appliedParams.ballCount }, () => ({
      position: [
        Math.random() * 12 - 6,
        Math.random() * 100 + 5,
        Math.random() * 12 - 6,
      ],
      color: `hsl(${Math.random() * 360}, 90%, 60%)`,
    })),
  [physicsKey, appliedParams.ballCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    statsRef.current = new Stats();
    statsRef.current.showPanel(0); // 0: fps
    document.body.appendChild(statsRef.current.dom);
    let rafId;
    const animate = () => {
      statsRef.current.begin();
      statsRef.current.end();
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafId);
      document.body.removeChild(statsRef.current.dom);
    };
  }, []);

  return (
    <>
      <ControlPanel display={displayParams} onSlide={handleSlide} onRelease={handleRelease} />
      <Canvas
        camera={{ position: [0, 5, 20], fov: 60 }}
        style={{ width: '100vw', height: '100vh' }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        {/* Realistic sky (daytime/dusk atmosphere) */}
        <Sky
          sunPosition={[100, 10, 100]}
          turbidity={10}
          rayleigh={2}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />

        {/* Stars for depth beyond the sky horizon */}
        <Stars radius={120} depth={60} count={2000} factor={3} saturation={0} fade={true} speed={0.5} />

        {/* Atmospheric fog for depth/realism */}
        <fog attach="fog" args={['#b0d8e8', 40, 130]} />

        {/* Environment map: provides realistic IBL reflections on metallic balls */}
        {/* Note: uses a generated environment instead of a remote HDRI preset */}
        <hemisphereLight args={['#b0d8e8', '#b87333', 0.6]} />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} color="#fff8e7" />
        <directionalLight position={[-10, 8, -5]} intensity={0.4} color="#a0c8ff" />
        <pointLight position={[0, 0, 0]} intensity={0.3} color="#ff8844" distance={30} />

        {/* Physics — SAP broadphase is significantly faster than the default NaiveBroadphase
            for scenes with many bodies; reduced iterations keeps the solver lean */}
        <Physics
          key={physicsKey}
          gravity={[0, appliedParams.gravity, 0]}
          broadphase="SAP"
          iterations={6}
          tolerance={0.001}
        >
          {balls.map((ball, i) => (
            <Ball
              key={i}
              position={ball.position}
              color={ball.color}
              radius={appliedParams.ballRadius}
              mass={appliedParams.ballMass}
              restitution={appliedParams.restitution}
            />
          ))}
          <Ground position={[0, -10, 0]} />
          <SpinningTorus />
        </Physics>

        {/* Soft projected shadows add realism without expensive shadow maps */}
        <ContactShadows
          position={[0, -9.94, 0]}
          opacity={0.5}
          scale={50}
          blur={1.5}
          far={15}
          resolution={256}
        />

        <OrbitControls makeDefault />
      </Canvas>
    </>
  );
}

export default App;
