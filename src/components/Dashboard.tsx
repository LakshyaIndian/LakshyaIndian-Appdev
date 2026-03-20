import React, { useState, useRef } from 'react';
import { FileUp, Loader2, TrendingUp, TrendingDown, MessageSquare, PieChart, ChevronRight, History, BookOpen, AlertCircle } from 'lucide-react';
import { analyzeTranscript, generateSentimentGauge, chatWithPersonas } from '../services/geminiService';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { Transcript, Message } from '../types';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Dashboard = ({ userId }: { userId: string }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [chatExpanded, setChatExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ensureString = (val: any): string => {
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join('\n\n');
    if (val === null || val === undefined) return '';
    return String(val);
  };

  // Check for API key selection
  React.useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        // Fallback or local dev
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success per instructions
    }
  };

  // Load transcripts
  React.useEffect(() => {
    const q = query(
      collection(db, 'transcripts'), 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transcript));
      setTranscripts(docs);
    });
    return () => unsubscribe();
  }, [userId]);

  // Load messages
  React.useEffect(() => {
    if (!selectedTranscript?.id) return;
    const q = query(
      collection(db, 'transcripts', selectedTranscript.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(docs);
    });
    return () => unsubscribe();
  }, [selectedTranscript]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('pdf', file);

      let text = "";
      try {
        const parseRes = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData
        });
        
        const resData = await parseRes.json();
        
        if (parseRes.ok) {
          text = resData.text;
        } else {
          console.warn("Server-side PDF parsing failed, falling back to Gemini native processing.");
        }
      } catch (err) {
        console.warn("Server-side PDF parsing error, falling back to Gemini native processing:", err);
      }

      let analysis;
      if (text) {
        analysis = await analyzeTranscript({ text });
      } else {
        // Convert to base64 for Gemini native processing
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
        });
        analysis = await analyzeTranscript({ pdfBase64: base64 });
        text = analysis.extractedText || "Text extracted by Gemini AI.";
      }

      const sentimentImageUrl = await generateSentimentGauge(analysis.sentimentPrompt);

      const transcriptData = {
        userId,
        fileName: file.name,
        content: text,
        bullArgs: analysis.bull,
        bearArgs: analysis.bear,
        summary: analysis.summary || '',
        sentimentImageUrl: sentimentImageUrl || '',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'transcripts'), transcriptData);
      setSelectedTranscript({ id: docRef.id, ...transcriptData });
    } catch (error: any) {
      console.error("Analysis failed:", error);
      if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("Your selected API key is invalid or has been revoked. Please select a new one.");
      } else {
        setError(error.message || "An unexpected error occurred during analysis.");
      }
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedTranscript || chatLoading) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatLoading(true);

    try {
      // Add user message
      await addDoc(collection(db, 'transcripts', selectedTranscript.id, 'messages'), {
        transcriptId: selectedTranscript.id,
        userId,
        role: 'user',
        content: userMsg,
        createdAt: new Date().toISOString()
      });

      const responses = await chatWithPersonas(selectedTranscript.content, userMsg, messages);

      // Add bull message
      await addDoc(collection(db, 'transcripts', selectedTranscript.id, 'messages'), {
        transcriptId: selectedTranscript.id,
        userId,
        role: 'bull',
        content: responses.bull,
        createdAt: new Date().toISOString()
      });

      // Add bear message
      await addDoc(collection(db, 'transcripts', selectedTranscript.id, 'messages'), {
        transcriptId: selectedTranscript.id,
        userId,
        role: 'bear',
        content: responses.bear,
        createdAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Chat failed:", error);
      if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("Your selected API key is invalid or has been revoked. Please select a new one.");
      }
    } finally {
      setChatLoading(false);
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <PieChart className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">API Key Required</h2>
          <p className="text-zinc-400 mb-8">
            To generate high-quality sentiment visuals and perform advanced analysis, you need to select a Gemini API key from a paid Google Cloud project.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-3 px-6 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Select API Key
            <ChevronRight className="w-4 h-4" />
          </button>
          <p className="mt-6 text-xs text-zinc-500 text-center">
            Learn more about <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-300">Gemini API billing</a>.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-zinc-50 relative">
      {/* Mobile Sidebar Toggle */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden absolute bottom-24 right-6 z-50 w-12 h-12 bg-zinc-900 text-white rounded-full shadow-2xl flex items-center justify-center"
      >
        <History className="w-6 h-6" />
      </button>

      {/* Sidebar: History */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 border-r border-zinc-200 bg-white flex flex-col transition-transform duration-300 md:relative md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between text-zinc-900 font-semibold">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            Recent Analysis
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 hover:bg-zinc-100 rounded-lg">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {transcripts.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedTranscript(t);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              className={cn(
                "w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 group",
                selectedTranscript?.id === t.id 
                  ? "bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100" 
                  : "hover:bg-zinc-100 text-zinc-600"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                selectedTranscript?.id === t.id ? "bg-emerald-100" : "bg-zinc-100 group-hover:bg-zinc-200"
              )}>
                <PieChart className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-sm font-medium truncate">{t.fileName}</div>
                <div className="text-[10px] opacity-60">
                  {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Unknown date'}
                </div>
              </div>
            </button>
          ))}
          {transcripts.length === 0 && (
            <div className="p-8 text-center text-zinc-400 text-sm italic">
              No transcripts yet. Upload a PDF to start.
            </div>
          )}
        </div>
        <div className="p-4 border-t border-zinc-200">
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-xs text-rose-600"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
          <input 
            type="file" 
            accept=".pdf" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing}
            className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-lg shadow-zinc-200"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            Upload Transcript
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {selectedTranscript ? (
          <>
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Summary Section */}
              <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="p-8 border-b border-zinc-200 bg-white"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-zinc-100 rounded-lg">
                    <BookOpen className="w-6 h-6 text-zinc-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-900">Executive Summary</h2>
                </div>
                <div className="prose prose-zinc max-w-none text-zinc-600 leading-relaxed">
                  <ReactMarkdown>{ensureString(selectedTranscript.summary) || 'No summary available.'}</ReactMarkdown>
                </div>
              </motion.div>
  
              {/* Split Screen Analysis */}
              <div className="flex-1 flex min-h-[500px]">
                {/* Bull Side */}
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="flex-1 p-8 border-r border-emerald-100 bg-emerald-50/30"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-emerald-900">Bull Case</h2>
                  </div>
                  <div className="prose prose-emerald max-w-none text-emerald-950 leading-relaxed">
                    <ReactMarkdown>{ensureString(selectedTranscript.bullArgs) || 'No bull arguments available.'}</ReactMarkdown>
                  </div>
                </motion.div>
  
                {/* Bear Side */}
                <motion.div 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="flex-1 p-8 bg-rose-50/30"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-rose-100 rounded-lg">
                      <TrendingDown className="w-6 h-6 text-rose-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-rose-900">Bear Case</h2>
                  </div>
                  <div className="prose prose-rose max-w-none text-rose-950 leading-relaxed">
                    <ReactMarkdown>{ensureString(selectedTranscript.bearArgs) || 'No bear arguments available.'}</ReactMarkdown>
                  </div>
                </motion.div>
              </div>
            </div>
  
            {/* Sentiment Gauge Overlay */}
            {selectedTranscript.sentimentImageUrl && (
              <div className="absolute top-4 right-4 w-48 h-48 bg-white/80 backdrop-blur-md rounded-2xl p-2 shadow-xl border border-white/20 z-10">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 text-center">Sentiment Gauge</div>
                <img 
                  src={selectedTranscript.sentimentImageUrl} 
                  alt="Sentiment" 
                  className="w-full h-full object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {/* Chat Panel */}
            <div className={cn(
              "border-t border-zinc-200 bg-white flex flex-col shadow-2xl transition-all duration-300 ease-in-out",
              chatExpanded ? "h-[500px]" : "h-16"
            )}>
              <div 
                onClick={() => setChatExpanded(!chatExpanded)}
                className="p-3 border-b border-zinc-100 flex items-center justify-between cursor-pointer hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  Interactive Debate
                </div>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && !chatExpanded && (
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                      {messages.length} messages
                    </span>
                  )}
                  <ChevronRight className={cn(
                    "w-4 h-4 text-zinc-400 transition-transform",
                    chatExpanded ? "rotate-90" : "-rotate-90"
                  )} />
                </div>
              </div>
              
              <AnimatePresence>
                {chatExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex-1 flex flex-col overflow-hidden"
                  >
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50">
                      {messages.map(m => (
                        <div key={m.id} className={cn(
                          "flex flex-col max-w-[80%]",
                          m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                        )}>
                          <div className={cn(
                            "px-4 py-2 rounded-2xl text-sm shadow-sm",
                            m.role === 'user' ? "bg-zinc-900 text-white rounded-tr-none" : 
                            m.role === 'bull' ? "bg-emerald-100 text-emerald-900 rounded-tl-none border border-emerald-200" :
                            "bg-rose-100 text-rose-900 rounded-tl-none border border-rose-200"
                          )}>
                            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-60">
                              {m.role}
                            </div>
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex gap-2 items-center text-zinc-400 text-xs italic">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Personas are debating...
                        </div>
                      )}
                    </div>
                    <form onSubmit={handleChat} className="p-4 bg-white border-t border-zinc-100 flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask about debt-to-equity, revenue growth, etc..."
                        className="flex-1 px-4 py-2 bg-zinc-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
                      />
                      <button 
                        type="submit"
                        disabled={chatLoading || !chatInput.trim()}
                        className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white">
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
              <PieChart className="w-12 h-12 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-bold text-zinc-900 mb-2">Welcome to StockSensei</h2>
            <p className="text-zinc-500 max-w-md mb-8">
              Upload an earnings call transcript PDF to generate a Bull vs. Bear debate and visualize market sentiment.
            </p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 font-bold text-lg"
            >
              <FileUp className="w-6 h-6" />
              Get Started
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
