"use client"
import React, { useState, useEffect, useRef } from 'react';
import { Activity, MessageSquare, Heart, Droplets, Thermometer, ChevronRight, Send, Bot, X, PlusCircle, Video, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const healthData = [{
  time: '08:00',
  heartRate: 72,
  bloodPressure: 118
}, {
  time: '10:00',
  heartRate: 75,
  bloodPressure: 120
}, {
  time: '12:00',
  heartRate: 82,
  bloodPressure: 122
}, {
  time: '14:00',
  heartRate: 78,
  bloodPressure: 121
}, {
  time: '16:00',
  heartRate: 74,
  bloodPressure: 119
}, {
  time: '18:00',
  heartRate: 70,
  bloodPressure: 118
}, {
  time: '20:00',
  heartRate: 68,
  bloodPressure: 117
}];

const appointments = [{
  id: 1,
  doctor: 'Dr. Sarah Wilson',
  specialty: 'Cardiologist',
  time: 'Tomorrow, 10:30 AM',
  avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop'
}, {
  id: 2,
  doctor: 'Dr. James Miller',
  specialty: 'General Practitioner',
  time: 'Oct 24, 02:15 PM',
  avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop'
}];

const MetricCard = ({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  color
}: any) => (
  <motion.div
    whileHover={{ y: -4 }}
    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between"
  >
    <div className="flex justify-between items-start">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
        {trend > 0 ? '+' : ''}{trend}%
      </span>
    </div>
    <div className="mt-4">
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        <span className="text-slate-400 text-sm">{unit}</span>
      </div>
    </div>
  </motion.div>
);

export default function PortalPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [timeRange, setTimeRange] = useState("Last 24 Hours");
  const [messages, setMessages] = useState([{
    role: 'assistant',
    text: 'Hello! I am your Health AI Assistant. How can I help you today?'
  }]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const aiReplyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (aiReplyTimeoutRef.current) {
        clearTimeout(aiReplyTimeoutRef.current);
        aiReplyTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const userMessage = { role: 'user', text: inputValue };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    aiReplyTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: "I've noted that in your health record. Would you like me to schedule a follow-up with Dr. Wilson regarding this?"
      }]);
    }, 1000);
  };
  const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeRange(e.target.value);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 text-slate-900">
      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Good morning, Alex</h1>
          <p className="text-slate-500 mt-1">Everything looks stable. You have a session with your AI assistant at 2:00 PM.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm">
            <PlusCircle size={18} />
            <span>Log Vitals</span>
          </button>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-all shadow-md shadow-blue-100">
            <Video size={18} />
            <span>Join Consultation</span>
          </button>
        </div>
      </section>

      {/* AI Room Navigator */}
      <motion.section
        whileHover={{ scale: 1.01 }}
        className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm overflow-hidden relative cursor-pointer"
        onClick={() => setChatOpen(true)}
      >
        <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-50/50 -skew-x-12 translate-x-12 z-0"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 shrink-0">
            <Bot size={40} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Enter Your Personal Health AI Room</h2>
            <p className="text-slate-500 max-w-lg">Get real-time insights, analyze symptoms, and connect with your medical data through our most advanced neural engine.</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                </div>
              ))}
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">Active Now</span>
          </div>
          <button className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shrink-0">
            Enter Room <ChevronRight size={18} />
          </button>
        </div>
      </motion.section>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Heart Rate" value="72" unit="bpm" icon={Heart} trend={+4.2} color="bg-rose-500" />
        <MetricCard title="Blood Pressure" value="118/79" unit="mmHg" icon={Activity} trend={-1.5} color="bg-blue-500" />
        <MetricCard title="Glucose Level" value="94" unit="mg/dL" icon={Droplets} trend={+0.8} color="bg-teal-500" />
        <MetricCard title="Body Temp" value="98.2" unit="°F" icon={Thermometer} trend={-0.2} color="bg-amber-500" />
      </section>

      {/* Chart & Appointments Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Heart Rate Dynamics</h3>
              <p className="text-sm text-slate-500">Real-time physiological telemetry</p>
            </div>
            <select
              value={timeRange}
              onChange={handleTimeRangeChange}
              className="bg-slate-50 border-none text-sm font-medium rounded-lg px-3 py-1 focus:ring-0"
            >
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={healthData}>
                <defs>
                  <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="heartRate" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorHr)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Upcoming Appointments</h3>
            <div className="space-y-4">
              {appointments.map(apt => (
                <div key={apt.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <img src={apt.avatar} alt={apt.doctor} className="w-12 h-12 rounded-xl object-cover" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800">{apt.doctor}</h4>
                    <p className="text-xs text-slate-500 font-medium">{apt.specialty}</p>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-600 font-bold bg-blue-50 w-fit px-2 py-0.5 rounded-full uppercase">
                      <Clock size={10} />
                      {apt.time}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 text-slate-500 font-semibold text-sm border-t border-slate-100 hover:text-blue-600 transition-colors">
              View All Appointments
            </button>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 opacity-10">
              <Activity size={120} />
            </div>
            <h3 className="text-lg font-bold mb-2">Physician Network</h3>
            <p className="text-slate-400 text-sm mb-6">Instantly connect with over 500+ specialized doctors in our workspace network.</p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-800 bg-slate-700 overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?u=${i}`} alt="doc" />
                  </div>
                ))}
              </div>
              <span className="text-xs font-medium text-slate-300">+24 Available</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick AI Floating Chat Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-200 flex items-center justify-center z-50 cursor-pointer"
      >
        {chatOpen ? <X size={28} /> : <MessageSquare size={28} />}
      </motion.button>

      {/* AI Quick Chat Widget */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-28 right-8 w-96 bg-white rounded-3xl shadow-2xl z-50 overflow-hidden border border-slate-100 flex flex-col"
            style={{ maxHeight: 'calc(100vh - 160px)' }}
          >
            <div className="bg-blue-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="font-bold">Health AI</h3>
                  <p className="text-xs text-blue-100">Always online for you</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px]">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Ask any general question..."
                className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20"
              />
              <button type="submit" className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors shrink-0">
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
