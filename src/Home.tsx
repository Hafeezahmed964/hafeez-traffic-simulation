/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Play, Zap, Map, Clock, ShieldCheck, LogOut } from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './lib/firebase';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">UrbanFlow <span className="text-blue-600">Core</span></h1>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 uppercase tracking-wider">
            <Link to="/" className="text-blue-600">Home</Link>
            <Link to="/sim" className="hover:text-blue-600 transition-colors">Start Simulation</Link>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-600 hidden sm:inline-block">
                  {user.displayName || user.email}
                </span>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-sm font-bold text-red-500 px-4 py-2 hover:bg-red-50 rounded-lg transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="text-sm font-bold text-slate-600 px-4 py-2 hover:bg-slate-50 rounded-lg transition-all">Login</Link>
                <Link to="/signup" className="text-sm font-bold bg-blue-600 text-white px-5 py-2.5 rounded-lg shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[1000px] h-[1000px] bg-blue-50 rounded-full -z-10 blur-3xl opacity-50" />
        
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-widening border border-blue-100">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              Live Traffic Analytics Engine
            </div>
            
            <h1 className="text-6xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
              Welcome to <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500">
                Traffic Simulation System
              </span>
            </h1>
            
            <p className="text-xl text-slate-600 leading-relaxed max-w-xl">
              This system simulates real-world traffic flow with smart traffic light control. 
              Optimize intersections, reduce congestion, and save fuel using intelligent agents.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link to="/sim" className="flex items-center justify-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl shadow-blue-500/40 hover:scale-105 transition-transform group">
                <Play className="w-5 h-5 fill-current" />
                Start Simulation
              </Link>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            {/* Visual Mockup representing City/Roads */}
            <div className="rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border-8 border-white bg-slate-900 aspect-video relative">
               <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-20 bg-slate-800 relative">
                    <div className="absolute top-1/2 w-full h-[1px] border-t-2 border-dashed border-white/20" />
                    {/* Animated Cars */}
                    <motion.div 
                      animate={{ x: [-100, 1000] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                      className="absolute top-4 w-12 h-6 bg-blue-500 rounded shadow-lg shadow-blue-500/40"
                    />
                    <motion.div 
                      animate={{ x: [1000, -100] }}
                      transition={{ duration:7, repeat: Infinity, ease: "linear" }}
                      className="absolute bottom-4 w-12 h-6 bg-emerald-500 rounded shadow-lg shadow-emerald-500/40"
                    />
                  </div>
               </div>
               
               {/* Traffic light overlay */}
               <div className="absolute top-10 right-10 flex flex-col gap-2 p-2 bg-black rounded-xl border border-white/10">
                  <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)]" />
                  <div className="w-4 h-4 rounded-full bg-slate-800" />
                  <div className="w-4 h-4 rounded-full bg-slate-800" />
               </div>
            </div>
            

          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<Map className="w-6 h-6 text-blue-600" />}
            title="Grid Intelligence"
            desc="Manage complex urban intersections with autonomous agent routing."
          />
          <FeatureCard 
            icon={<Clock className="w-6 h-6 text-amber-600" />}
            title="Real-time Control"
            desc="Instant status synchronization across all nodes using Firebase."
          />
          <FeatureCard 
            icon={<ShieldCheck className="w-6 h-6 text-emerald-600" />}
            title="Safety First"
            desc="Advanced collision avoidance systems built for tomorrow's city."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 grayscale opacity-60">
            <Zap className="w-5 h-5 text-slate-900" />
            <h1 className="text-lg font-bold tracking-tight text-slate-900 uppercase">UrbanFlow</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium font-mono">
            © 2026 Traffic Simulation System. Built for Urban Planning.
          </p>
          <div className="flex gap-6 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shadow-inner mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 leading-relaxed text-sm">
        {desc}
      </p>
    </div>
  );
}
