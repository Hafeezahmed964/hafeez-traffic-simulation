/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Activity, 
  Zap, 
  LayoutGrid, 
  AlertCircle,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { initFirebase, auth } from './lib/firebase';

// --- TYPES ---

type TrafficLightState = 'RED' | 'YELLOW' | 'GREEN';

interface Road {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  lanes: number;
}

interface Intersection {
  id: string;
  x: number;
  y: number;
  lightState: TrafficLightState;
  timer: number;
}

interface Vehicle {
  id: string;
  x: number;
  y: number;
  speed: number;
  targetX: number;
  targetY: number;
  roadId: string;
  color: string;
  isEmergency?: boolean;
}

const AMBULANCE_SPAWN_RATE = 0.003;
const EMERGENCY_SPEED = 4.5;
const NORMAL_SPEED = 3.0;

interface SimulationState {
  activeVehicles: Vehicle[];
  intersections: Intersection[];
  stats: {
    totalSpawned: number;
    activeCount: number;
    avgSpeed: number;
  };
}

// --- SIMULATION CONSTANTS ---

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const ROAD_WIDTH = 60; // Wider for multi-lane
const LANE_WIDTH = 15;
const VEHICLE_SIZE = 12;
const SPAWN_RATE = 0.015; 

const TIMING = {
  RED: 300,    // 5s at 60fps
  YELLOW: 120, // 2s
  GREEN: 300   // 5s
};

const GRID_ROADS: Road[] = [
  { id: 'h1', startX: 0, startY: 300, endX: 800, endY: 300, lanes: 4 },
  { id: 'v1', startX: 400, startY: 0, endX: 400, endY: 600, lanes: 4 },
];

const GRID_INTERSECTIONS: Intersection[] = [
  { id: 'int1', x: 400, y: 300, lightState: 'GREEN', timer: TIMING.GREEN },
];

const VEHICLE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

// --- APP COMPONENT ---

import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Home from './Home';
import { Login, Signup } from './Auth';

// ... (keep existing imports and simulation logic but wrap in a component)

function SimulationDashboard() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isTrafficMenuOpen, setIsTrafficMenuOpen] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [intersections, setIntersections] = useState<Intersection[]>(GRID_INTERSECTIONS);
  const [stats, setStats] = useState({ totalSpawned: 0, activeCount: 0, avgSpeed: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const navigate = useNavigate();

  // Initialize
  useEffect(() => {
    initFirebase().then(({ auth: firebaseAuth }) => {
      if (firebaseAuth) {
        setFirebaseReady(true);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const spawnAmbulance = () => {
    const road = GRID_ROADS[Math.floor(Math.random() * GRID_ROADS.length)];
    const isHorizontal = road.startY === road.endY;
    const laneOffset = (Math.floor(Math.random() * 2) === 0 ? -1 : 1) * (LANE_WIDTH * 0.8);
    const startX = isHorizontal ? (Math.random() > 0.5 ? 0 : 800) : road.startX + laneOffset;
    const startY = isHorizontal ? road.startY + laneOffset : (Math.random() > 0.5 ? 0 : 600);
    const targetX = isHorizontal ? (startX === 0 ? 800 : 0) : road.startX + laneOffset;
    const targetY = isHorizontal ? road.startY + laneOffset : (startY === 0 ? 600 : 0);

    setVehicles(prev => [...prev, {
      id: 'emergency-' + Math.random().toString(36).substr(2, 9),
      x: startX,
      y: startY,
      speed: 0,
      targetX,
      targetY,
      roadId: road.id,
      color: '#ffffff',
      isEmergency: true
    }]);
    setStats(s => ({ ...s, totalSpawned: s.totalSpawned + 1 }));
  };
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Firebase Syncing
  useEffect(() => {
     if (firebaseReady && isPlaying) {
       const interval = setInterval(async () => {
          const { db } = await initFirebase();
          if (!db) return;
          try {
            const simDoc = doc(db, 'simulations', 'global_traffic');
            await setDoc(simDoc, { 
              stats: {
                activeVehiclesCount: vehicles.length,
                totalSpawned: stats.totalSpawned,
                updatedAt: new Date().toISOString()
              }
            }, { merge: true });
          } catch (e) {
            console.error("Sync error", e);
          }
       }, 5000);
       return () => clearInterval(interval);
     }
  }, [firebaseReady, isPlaying, vehicles.length, stats.totalSpawned]);

  // Simulation Loop
  const updateSimulation = () => {
    if (!isPlaying) return;

    let nextVehicles: Vehicle[] = [];
    
    // 1. Update Vehicles
    setVehicles((prev) => {
      const spawnedVehicles = [...prev];
      const isEmergencySpawn = Math.random() < AMBULANCE_SPAWN_RATE;

      if (Math.random() < SPAWN_RATE || isEmergencySpawn) {
        const road = GRID_ROADS[Math.floor(Math.random() * GRID_ROADS.length)];
        const isHorizontal = road.startY === road.endY;
        const laneOffset = (Math.floor(Math.random() * 2) === 0 ? -1 : 1) * (LANE_WIDTH * 0.8);
        const startX = isHorizontal ? (Math.random() > 0.5 ? 0 : 800) : road.startX + laneOffset;
        const startY = isHorizontal ? road.startY + laneOffset : (Math.random() > 0.5 ? 0 : 600);
        const targetX = isHorizontal ? (startX === 0 ? 800 : 0) : road.startX + laneOffset;
        const targetY = isHorizontal ? road.startY + laneOffset : (startY === 0 ? 600 : 0);

        spawnedVehicles.push({
          id: Math.random().toString(36).substr(2, 9),
          x: startX,
          y: startY,
          speed: 0,
          targetX,
          targetY,
          roadId: road.id,
          color: isEmergencySpawn ? '#ffffff' : VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)],
          isEmergency: isEmergencySpawn
        });
        setStats(s => ({ ...s, totalSpawned: s.totalSpawned + 1 }));
      }

      nextVehicles = spawnedVehicles.map(v => {
        let desiredSpeed = v.isEmergency ? EMERGENCY_SPEED : NORMAL_SPEED;
        const dx = v.targetX - v.x;
        const dy = v.targetY - v.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);
        
        if (distToTarget < 10) return null;

        // Intersection Check
        intersections.forEach(node => {
          const distToNode = Math.sqrt(Math.pow(v.x - node.x, 2) + Math.pow(v.y - node.y, 2));
          const isMovingTowards = (Math.abs(v.x - node.x) > 5 && (v.targetX > node.x ? v.x < node.x : v.x > node.x)) ||
                                 (Math.abs(v.y - node.y) > 5 && (v.targetY > node.y ? v.y < node.y : v.y > node.y));
          
          if (isMovingTowards && distToNode < 150) {
            const isHorizontalFlow = v.roadId === 'h1'; 
            const activeGreen = isHorizontalFlow ? (node.lightState === 'GREEN') : (node.lightState === 'RED'); 
            
            if (!activeGreen && !v.isEmergency) {
              desiredSpeed = Math.min(desiredSpeed, (distToNode - 35) / 10);
              if (distToNode < 40) desiredSpeed = 0;
            }
          }
        });

        let currentSpeed = v.speed;
        if (currentSpeed < desiredSpeed) currentSpeed += 0.1;
        if (currentSpeed > desiredSpeed) currentSpeed -= 0.15;
        if (currentSpeed < 0) currentSpeed = 0;

        const moveDx = (v.targetX - v.x);
        const moveDy = (v.targetY - v.y);
        const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
        
        return { 
          ...v, 
          speed: currentSpeed,
          x: v.x + (moveDx / moveDist) * currentSpeed, 
          y: v.y + (moveDy / moveDist) * currentSpeed 
        };
      }).filter(Boolean) as Vehicle[];
      return nextVehicles;
    });

    // 2. Update Intersections
    setIntersections(prev => 
      prev.map(int => {
        const approachingAmbulance = nextVehicles.find(v => {
          if (!v.isEmergency) return false;
          const dist = Math.sqrt(Math.pow(v.x - int.x, 2) + Math.pow(v.y - int.y, 2));
          if (dist > 180) return false;
          const isMovingTowards = (Math.abs(v.x - int.x) > 5 && (v.targetX > int.x ? v.x < int.x : v.x > int.x)) ||
                                 (Math.abs(v.y - int.y) > 5 && (v.targetY > int.y ? v.y < int.y : v.y > int.y));
          return isMovingTowards;
        });

        if (approachingAmbulance) {
          const isHorizontalFlow = approachingAmbulance.roadId === 'h1';
          const isNorthSouthFlow = approachingAmbulance.roadId === 'v1';
          if (isHorizontalFlow && int.lightState !== 'GREEN') return { ...int, lightState: 'GREEN', timer: 300 };
          if (isNorthSouthFlow && int.lightState !== 'RED') return { ...int, lightState: 'RED', timer: 300 };
          return { ...int, timer: 300 };
        }

        const nextTimer = int.timer - 1;
        if (nextTimer <= 0) {
          let nextState: TrafficLightState = 'GREEN';
          let nextTimerVal = TIMING.GREEN;
          if (int.lightState === 'GREEN') { nextState = 'YELLOW'; nextTimerVal = TIMING.YELLOW; }
          else if (int.lightState === 'YELLOW') { nextState = 'RED'; nextTimerVal = TIMING.RED; }
          else { nextState = 'GREEN'; nextTimerVal = TIMING.GREEN; }
          return { ...int, lightState: nextState, timer: nextTimerVal };
        }
        return { ...int, timer: nextTimer };
      })
    );
    requestRef.current = requestAnimationFrame(updateSimulation);
  };

  useEffect(() => {
    if (isPlaying) { requestRef.current = requestAnimationFrame(updateSimulation); }
    else { cancelAnimationFrame(requestRef.current); }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, intersections]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i<CANVAS_WIDTH; i+=40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke(); }
    for(let i=0; i<CANVAS_HEIGHT; i+=40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke(); }

    ctx.fillStyle = '#334155';
    GRID_ROADS.forEach(road => {
      const isHorizontal = road.startY === road.endY;
      if (isHorizontal) {
        ctx.fillRect(road.startX, road.startY - ROAD_WIDTH/2, road.endX - road.startX, ROAD_WIDTH);
        
        ctx.setLineDash([10, 15]); ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        // Lane Dividers
        ctx.beginPath(); ctx.moveTo(road.startX, road.startY); ctx.lineTo(road.endX, road.startY); ctx.stroke();
        
        ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        // Road Edges
        ctx.beginPath(); ctx.moveTo(road.startX, road.startY - ROAD_WIDTH/2); ctx.lineTo(road.endX, road.startY - ROAD_WIDTH/2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(road.startX, road.startY + ROAD_WIDTH/2); ctx.lineTo(road.endX, road.startY + ROAD_WIDTH/2); ctx.stroke();
      } else {
        ctx.fillRect(road.startX - ROAD_WIDTH/2, road.startY, ROAD_WIDTH, road.endY - road.startY);
        
        ctx.setLineDash([10, 15]); ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        // Lane Dividers
        ctx.beginPath(); ctx.moveTo(road.startX, road.startY); ctx.lineTo(road.startX, road.endY); ctx.stroke();

        ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        // Road Edges
        ctx.beginPath(); ctx.moveTo(road.startX - ROAD_WIDTH/2, road.startY); ctx.lineTo(road.startX - ROAD_WIDTH/2, road.endY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(road.startX + ROAD_WIDTH/2, road.startY); ctx.lineTo(road.startX + ROAD_WIDTH/2, road.endY); ctx.stroke();
      }
    });

    intersections.forEach(int => {
       ctx.fillStyle = '#334155';
       ctx.fillRect(int.x - ROAD_WIDTH/2, int.y - ROAD_WIDTH/2, ROAD_WIDTH, ROAD_WIDTH);
       
       const drawTrafficLight = (lx: number, ly: number, state: TrafficLightState) => {
         ctx.fillStyle = '#0f172a';
         ctx.beginPath(); ctx.roundRect(lx, ly, 16, 44, 4); ctx.fill();
         
         const drawBulb = (by: number, color: string, active: boolean) => {
           ctx.beginPath(); ctx.arc(lx + 8, by, 5, 0, Math.PI * 2);
           ctx.fillStyle = active ? color : '#1e1e2e';
           if (active) { ctx.shadowBlur = 15; ctx.shadowColor = color; }
           ctx.fill(); ctx.shadowBlur = 0;
         };
         drawBulb(ly + 10, '#ef4444', state === 'RED');
         drawBulb(ly + 22, '#f59e0b', state === 'YELLOW');
         drawBulb(ly + 34, '#10b981', state === 'GREEN');
       };

       // North Light
       drawTrafficLight(int.x - ROAD_WIDTH/2 - 25, int.y - ROAD_WIDTH/2 - 50, int.lightState);
       // East Light (Opposite phase logic handled in update)
       drawTrafficLight(int.x + ROAD_WIDTH/2 + 10, int.y - ROAD_WIDTH/2 - 10, int.lightState === 'GREEN' ? 'RED' : (int.lightState === 'YELLOW' ? 'RED' : 'GREEN'));
    });

    vehicles.forEach(v => {
      const angle = Math.atan2(v.targetY - v.y, v.targetX - v.x);
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(angle);
      
      // Car Body
      if (v.isEmergency) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
        ctx.beginPath(); ctx.roundRect(-VEHICLE_SIZE, -VEHICLE_SIZE/2, VEHICLE_SIZE*2, VEHICLE_SIZE, 3); ctx.fill();
        
        // Red Cross
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-2, -VEHICLE_SIZE/4, 4, VEHICLE_SIZE/2);
        ctx.fillRect(-VEHICLE_SIZE/4, -2, VEHICLE_SIZE/2, 4);

        // Siren effect
        const sirenAlpha = (Math.sin(Date.now() / 100) + 1) / 2;
        ctx.fillStyle = `rgba(239, 68, 68, ${sirenAlpha})`;
        ctx.beginPath(); ctx.arc(VEHICLE_SIZE/2, 0, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = v.color;
        ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.roundRect(-VEHICLE_SIZE, -VEHICLE_SIZE/2, VEHICLE_SIZE*2, VEHICLE_SIZE, 3); ctx.fill();
      }
      
      // Windshield
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(VEHICLE_SIZE/4, -VEHICLE_SIZE/2 + 2, VEHICLE_SIZE/2, VEHICLE_SIZE - 4);
      
      // Tail lights if braking
      if (v.speed < 0.5) {
        ctx.fillStyle = '#f87171';
        ctx.fillRect(-VEHICLE_SIZE, -VEHICLE_SIZE/2, 2, 2);
        ctx.fillRect(-VEHICLE_SIZE, VEHICLE_SIZE/2 - 2, 2, 2);
      }
      
      ctx.restore();
    });
  }, [vehicles, intersections]);

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <Link to="/" className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-sm">
            <Zap className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-lg font-bold tracking-tight text-slate-800 uppercase">UrbanFlow <span className="text-blue-600 font-medium">Core</span></h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <div className={`w-2 h-2 rounded-full ${firebaseReady ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
            {firebaseReady ? 'FIREBASE REAL-TIME SYNC ACTIVE' : 'LOCAL CACHE MODE'}
          </div>
          {user && (
             <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
               <span className="text-[10px] font-bold text-slate-500 truncate max-w-[100px] font-mono">{user.displayName || user.email}</span>
               <button 
                onClick={handleLogout}
                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                title="Logout"
               >
                 <LogOut className="w-4 h-4" />
               </button>
             </div>
          )}
          <Link to="/" className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest font-mono">Exit</Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white border-r border-slate-200 p-5 flex flex-col gap-8 shrink-0 overflow-y-auto custom-scrollbar">


          <div>
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 font-mono">Manual Overrides</h2>
            <div className="space-y-3">
              <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                <button 
                  onClick={() => setIsTrafficMenuOpen(!isTrafficMenuOpen)}
                  className="w-full flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1 p-1 bg-slate-900 rounded-md">
                      <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                      <div className="w-2 h-2 rounded-full bg-yellow-400" />
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Traffic Controller</span>
                  </div>
                  <LayoutGrid className={`w-3 h-3 text-slate-300 transition-transform ${isTrafficMenuOpen ? 'rotate-90' : ''}`} />
                </button>

                <AnimatePresence>
                  {isTrafficMenuOpen && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 flex flex-col gap-2 border-t border-slate-100 mt-3">
                        <button 
                          onClick={() => setIntersections(prev => prev.map(int => ({ ...int, lightState: 'GREEN', timer: 600 })))}
                          className="flex items-center gap-3 p-2 hover:bg-emerald-50 rounded-lg group transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-emerald-700">Set All Green</span>
                        </button>
                        <button 
                          onClick={() => setIntersections(prev => prev.map(int => ({ ...int, lightState: 'RED', timer: 600 })))}
                          className="flex items-center gap-3 p-2 hover:bg-red-50 rounded-lg group transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-red-700">Set All Red</span>
                        </button>
                        <button 
                          onClick={() => setIntersections(prev => prev.map(int => ({ ...int, lightState: 'YELLOW', timer: 600 })))}
                          className="flex items-center gap-3 p-2 hover:bg-yellow-50 rounded-lg group transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full bg-yellow-400" />
                          <span className="text-[10px] font-bold uppercase text-slate-500 group-hover:text-yellow-700">Set All Yellow</span>
                        </button>
                        <button 
                          onClick={() => { spawnAmbulance(); setIsTrafficMenuOpen(false); }}
                          className="flex items-center gap-3 p-2 bg-slate-900 rounded-lg group hover:bg-red-600 transition-colors mt-2"
                        >
                          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          <span className="text-[10px] font-bold uppercase text-white">Ambulance Emergency</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="mt-auto border-t border-slate-100 pt-5 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Active Nodes</span>
              <span className="text-xs font-mono text-blue-600 font-bold">24/24</span>
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-slate-200 p-8 relative overflow-hidden flex flex-col gap-6">
          <div className="flex-1 relative rounded-xl overflow-hidden shadow-inner bg-slate-300 border border-slate-300/50">
            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="w-full h-full object-contain" />
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/90 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-xl">
              <button onClick={() => setIsPlaying(!isPlaying)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${isPlaying ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'}`}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pause Local' : 'Deploy Main'}
              </button>
              <button onClick={() => { setVehicles([]); setStats({ totalSpawned: 0, activeCount: 0, avgSpeed: 0 }); }} className="p-2.5 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 border border-transparent hover:border-slate-200">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="absolute top-6 left-6 p-4 bg-white/90 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm font-mono">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Network Throughput</div>
              <div className="text-3xl font-bold text-slate-800 leading-none">{vehicles.length.toString().padStart(2, '0')}<span className="text-[10px] font-normal text-slate-400 ml-2">v/cycle</span></div>
            </div>
          </div>


        </main>
      </div>

      <footer className="h-10 bg-slate-800 text-slate-400 px-6 flex items-center justify-between text-[10px] font-mono shrink-0">
        <div className="flex gap-4">
          <span className="text-emerald-400">● SYSTEM_ONLINE</span>
          <span className="text-slate-600">|</span>
          <span>SYNC_LATENCY: 24ms</span>
        </div>
        <div className="flex gap-4">
          <span className="text-blue-400">STABLE_V2.0</span>
          <span>TS: {Date.now()}</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sim" element={<SimulationDashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </Router>
  );
}



function StatRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-end border-b border-slate-50 pb-2 font-mono">
      <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
      <span className="text-sm font-bold text-slate-800">{value}</span>
    </div>
  );
}



