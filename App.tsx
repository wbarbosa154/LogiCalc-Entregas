import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Send, Truck, User, CheckCircle2, Settings2, MapPin, DollarSign, Clock, Navigation, RotateCcw, Calendar, QrCode, Banknote, ChevronLeft, ChevronDown, ChevronUp, Trash2, RotateCcw as ReloadIcon, History, Database } from 'lucide-react';
import { Stop, RouteCalculationResult, DeliveryRequest } from './types';
import AddressList from './components/AddressList';
import { calculateRoute } from './services/geminiService';
import { initDB, insertRequest, selectAllHistory, deleteRequest } from './services/db';

export default function App() {
  // --- State ---
  const [currentView, setCurrentView] = useState<'home' | 'my-page'>('home');

  const [requesterName, setRequesterName] = useState('');
  
  // Scheduling State
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const [stops, setStops] = useState<Stop[]>([
    { id: '1', address: '', observation: '' }, // Point 1 (Coleta)
    { id: '2', address: '', observation: '' }  // Point 2 (Entrega)
  ]);
  const [returnToStart, setReturnToStart] = useState(false);
  const [optimizeRoute, setOptimizeRoute] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouteCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Result UI State
  const [showResultDetails, setShowResultDetails] = useState(true);
  
  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'Pix' | 'Dinheiro' | ''>('');

  // History State (Loaded from SQL)
  const [history, setHistory] = useState<DeliveryRequest[]>([]);

  // --- Actions ---

  const addStop = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    setStops([...stops, { id: newId, address: '', observation: '' }]);
    setResult(null); 
  };

  const removeStop = (id: string) => {
    const newStops = stops.filter(s => s.id !== id);
    setStops(newStops);
    setResult(null); 
  };

  const updateAddress = (id: string, value: string) => {
    setStops(stops.map(s => s.id === id ? { ...s, address: value } : s));
  };

  const updateObservation = (id: string, value: string) => {
    setStops(stops.map(s => s.id === id ? { ...s, observation: value } : s));
  };

  const swapP1P2 = () => {
    if (stops.length < 2) return;
    const newStops = [...stops];
    // Swap address
    const tempAddress = newStops[0].address;
    newStops[0].address = newStops[1].address;
    newStops[1].address = tempAddress;
    // Swap observations too
    const tempObs = newStops[0].observation;
    newStops[0].observation = newStops[1].observation;
    newStops[1].observation = tempObs;
    
    setStops(newStops);
    setResult(null);
  };

  const saveToHistory = (calculationResult: RouteCalculationResult) => {
    const newEntry: DeliveryRequest = {
        id: Date.now().toString(),
        requesterName,
        stops: [...stops], // Copy stops array
        returnToStart,
        optimizeRoute,
        isScheduled,
        scheduledDate: scheduleDate,
        scheduledTime: scheduleTime,
        result: calculationResult,
        createdAt: Date.now()
    };

    // SQL Insert
    insertRequest(newEntry);
    
    // Update local state immediately for UI feedback
    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
  };

  const deleteFromHistory = (id: string) => {
    // SQL Delete
    deleteRequest(id);
    
    // Update UI
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
  };

  const restoreFromHistory = (item: DeliveryRequest) => {
    setRequesterName(item.requesterName);
    setStops(item.stops);
    setReturnToStart(item.returnToStart);
    setOptimizeRoute(item.optimizeRoute);
    setIsScheduled(item.isScheduled);
    setScheduleDate(item.scheduledDate || '');
    setScheduleTime(item.scheduledTime || '');
    setResult(item.result);
    setShowResultDetails(true);
    setPaymentMethod(''); // Reset payment method
    setError(null);
    setCurrentView('home');
  };

  const handleCalculate = async () => {
    // Validation
    if (!requesterName.trim()) {
      setError("Por favor, preencha o NOME DO SOLICITANTE.");
      return;
    }
    // Check minimum valid stops
    const validStops = stops.filter(s => s.address.trim().length > 0);
    if (validStops.length < 2) {
      setError("Preencha pelo menos o endereço de COLETA e ENTREGA.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setPaymentMethod(''); // Reset payment method on new calculation

    try {
      const data = await calculateRoute(stops, returnToStart, optimizeRoute);
      setResult(data);
      setShowResultDetails(true); // Auto-expand on new calculation
      saveToHistory(data); // Save automatically to SQL on success
    } catch (err: any) {
      setError(err.message || "Erro ao calcular. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppSend = () => {
    if (!result) return;

    const phone = "558587789135";
    
    // Format Message
    let message = `*🚛 ORÇAMENTO DE ENTREGA*\n\n`;
    message += `👤 *SOLICITANTE:* ${requesterName.toUpperCase()}\n`;

    // Add Scheduling Info
    if (isScheduled && scheduleDate && scheduleTime) {
        const [year, month, day] = scheduleDate.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        message += `📅 *AGENDAMENTO:* ${formattedDate} às ${scheduleTime}\n`;
    }

    message += `\n`;
    
    // Determine order of stops to display (Optimized or Sequential)
    let displayStops: Stop[] = stops.filter(s => s.address.trim().length > 0);

    if (optimizeRoute && result.optimizedOrder && result.optimizedOrder.length > 0) {
      const stopsMap = new Map(stops.map(s => [s.id, s]));
      const optimized = result.optimizedOrder
        .map(id => stopsMap.get(id))
        .filter((s): s is Stop => !!s);
      
      if (optimized.length > 0) {
        displayStops = optimized;
      }
    }

    displayStops.forEach((stop, index) => {
      const role = index === 0 ? "COLETA" : `ENTREGA ${index}`;
      message += `📍 *PONTO ${index + 1} (${role}):* ${stop.address}\n`;
      
      if (stop.observation && stop.observation.trim()) {
        message += `   📝 _Obs: ${stop.observation}_\n`;
      }
    });

    message += `\n-----------------------------------\n`;
    
    if (returnToStart) {
      message += `✅ *COM RETORNO* ao Ponto 1\n`;
    } else {
       message += `➡️ *SEM RETORNO* (Ordem Sequencial)\n`;
    }

    if (optimizeRoute && stops.length > 2) {
      message += `⚡ *Rota Otimizada:* SIM (Menor Distância)\n`;
    }

    message += `-----------------------------------\n\n`;
    message += `📏 *Distância:* ${result.totalDistanceKm} km\n`;
    message += `⏱️ *Tempo:* ${result.totalDurationMin} min\n`;
    message += `💰 *PREÇO ESTIMADO:* R$ ${result.estimatedPrice.toFixed(2)}\n`;
    
    if (paymentMethod) {
        message += `💳 *PAGAMENTO:* ${paymentMethod.toUpperCase()}\n`;
    }

    message += `\n🗺️ *Mapa da Rota:* ${result.mapUrl}\n`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  };

  // Handles resetting the form for a new quote
  const handleNewQuote = () => {
    setRequesterName('');
    setStops([
      { id: Math.random().toString(36).substring(2, 9), address: '', observation: '' },
      { id: Math.random().toString(36).substring(2, 9), address: '', observation: '' }
    ]);
    setResult(null);
    setReturnToStart(false);
    setOptimizeRoute(false);
    setIsScheduled(false);
    setScheduleDate('');
    setScheduleTime('');
    setPaymentMethod('');
    setError(null);
    
    setCurrentView('home');
  };

  // Persistence: Form Draft (logicalc_data_v2) & History (SQL)
  useEffect(() => {
    // Initialize SQL DB
    initDB();

    // Load Draft (Still LocalStorage for simple draft)
    const savedDraft = localStorage.getItem('logicalc_data_v2');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.requesterName) setRequesterName(parsed.requesterName);
        if (parsed.stops && Array.isArray(parsed.stops)) setStops(parsed.stops);
        if (parsed.isScheduled !== undefined) setIsScheduled(parsed.isScheduled);
        if (parsed.scheduleDate) setScheduleDate(parsed.scheduleDate);
        if (parsed.scheduleTime) setScheduleTime(parsed.scheduleTime);
        if (parsed.returnToStart !== undefined) setReturnToStart(parsed.returnToStart);
        if (parsed.optimizeRoute !== undefined) setOptimizeRoute(parsed.optimizeRoute);
      } catch (e) {
        console.error("Failed to load saved draft", e);
      }
    }

    // Load History from SQL
    const sqlHistory = selectAllHistory();
    setHistory(sqlHistory);

  }, []);

  // Refresh history when switching to My Page
  useEffect(() => {
    if (currentView === 'my-page') {
        const sqlHistory = selectAllHistory();
        setHistory(sqlHistory);
    }
  }, [currentView]);

  useEffect(() => {
    const data = { 
        requesterName, 
        stops,
        isScheduled,
        scheduleDate,
        scheduleTime,
        returnToStart,
        optimizeRoute
    };
    localStorage.setItem('logicalc_data_v2', JSON.stringify(data));
  }, [requesterName, stops, isScheduled, scheduleDate, scheduleTime, returnToStart, optimizeRoute]);

  // Logic to show "Include New Address" options only after typing in Point 2
  const showAddOptions = stops[1].address.length > 3; 

  // Helper to format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-32 font-sans text-slate-900 relative">
      
      {/* Header - Compact on mobile */}
      <div className="bg-indigo-700 text-white p-3 sm:p-4 shadow-lg sticky top-0 z-20">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2" onClick={() => setCurrentView('home')}>
             <div className="bg-white/20 p-1.5 rounded backdrop-blur-sm cursor-pointer">
               <Truck size={18} className="text-white" />
             </div>
             <h1 className="font-bold text-base sm:text-lg tracking-tight cursor-pointer">LogiCalc Entregas</h1>
          </div>

          {/* Minha Página Button */}
          <button 
            className={`flex items-center gap-2 bg-indigo-800/50 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg transition-all text-xs sm:text-sm font-medium border border-indigo-600/30 ${currentView === 'my-page' ? 'bg-indigo-900 border-indigo-400' : ''}`}
            onClick={() => setCurrentView('my-page')}
          >
            <User size={16} />
            <span>Minha Página</span>
          </button>
        </div>
      </div>

      <main className="max-w-xl mx-auto p-3 sm:p-4 mt-1">

        {currentView === 'home' ? (
          <div className="space-y-3 sm:space-y-5">
            {/* 1. Requester Name */}
            <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-indigo-50">
              <label className="block text-xs font-bold text-indigo-900 uppercase mb-2 flex items-center gap-1">
                <User size={14} /> Nome do Solicitante
              </label>
              <input
                type="text"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="Nome do cliente"
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-3 transition-all"
              />
            </div>

            {/* 1.5 Scheduling Option */}
            <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-indigo-50 transition-all duration-300">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-900 uppercase flex items-center gap-1">
                    <Calendar size={14} /> Agendamento
                </label>
                <div className="flex items-center">
                    <input 
                      type="checkbox" 
                      id="schedule-toggle"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="schedule-toggle" className="ml-2 text-sm text-gray-700 cursor-pointer select-none font-medium">
                      Agendar?
                    </label>
                </div>
              </div>
              
              {isScheduled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-100">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Data</label>
                    <input 
                      type="date" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hora</label>
                    <input 
                      type="time" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Addresses */}
            <div>
              <AddressList 
                stops={stops} 
                setStops={setStops}
                onAddressChange={updateAddress}
                onObservationChange={updateObservation}
                onRemove={removeStop}
                onSwapP1P2={swapP1P2}
              />
              
              {/* "Include New Address" Button - Visible only after interaction with P2 */}
              {showAddOptions && (
                <div className="mt-4">
                  <button 
                    onClick={addStop}
                    className="w-full py-3.5 sm:py-3 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl font-bold text-sm sm:text-base hover:bg-indigo-50 hover:border-indigo-400 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Plus size={18} /> INCLUIR NOVO ENDEREÇO
                  </button>
                </div>
              )}
            </div>

            {/* 3. Options (Optimization & Return) */}
            {showAddOptions && (
                <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-200 space-y-3">
                
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-2">
                    Configurações da Rota
                </h2>

                {/* Optimization Option - Visible only for 3+ stops */}
                {stops.length >= 3 && (
                    <div className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${optimizeRoute ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-200' : 'bg-white border-gray-200'}`}>
                        <input 
                        id="opt-route" 
                        type="checkbox" 
                        checked={optimizeRoute}
                        onChange={(e) => setOptimizeRoute(e.target.checked)}
                        className="w-5 h-5 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                        />
                        <label htmlFor="opt-route" className="cursor-pointer text-amber-900 text-sm font-medium flex-1">
                        Otimizar Rota <span className="text-xs font-normal text-amber-700 block">(Organizar para menor caminho)</span>
                        </label>
                    </div>
                )}

                {/* Return Options Checkboxes */}
                <div className="grid grid-cols-1 gap-2">
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${returnToStart ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'hover:bg-gray-50 border-gray-200'}`}>
                        <input 
                            type="checkbox" 
                            checked={returnToStart} 
                            onChange={() => setReturnToStart(true)} 
                            className="w-5 h-5 text-indigo-600 rounded-full border-gray-300 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <RotateCcw size={16} /> Com Retorno
                        </span>
                    </label>

                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${!returnToStart ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' : 'hover:bg-gray-50 border-gray-200'}`}>
                        <input 
                            type="checkbox" 
                            checked={!returnToStart} 
                            onChange={() => setReturnToStart(false)} 
                            className="w-5 h-5 text-indigo-600 rounded-full border-gray-300 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Truck size={16} /> Sem Retorno
                        </span>
                    </label>
                </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-100 border border-red-200 text-red-700 p-4 rounded-lg text-sm font-medium text-center animate-pulse">
                {error}
              </div>
            )}

            {/* 4. Result Card */}
            {result && (
              <div className="bg-slate-900 text-white rounded-3xl shadow-2xl overflow-hidden mb-6 ring-1 ring-white/10 relative isolate transition-all duration-500">
                {/* Background Effects */}
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="p-5 sm:p-6 relative z-10">
                  {/* Header with Toggle */}
                  <div 
                    className="flex items-center justify-between mb-2 cursor-pointer group select-none py-2"
                    onClick={() => setShowResultDetails(!showResultDetails)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${showResultDetails ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'} transition-colors`}>
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                          <h3 className="text-base sm:text-lg font-bold text-white leading-none">
                            Orçamento Pronto
                          </h3>
                          {!showResultDetails && (
                             <p className="text-xs text-slate-400 mt-1">Clique para expandir</p>
                          )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                         {optimizeRoute && result.optimizedOrder && (
                            <span className="hidden sm:block bg-amber-500/10 text-amber-400 text-[10px] px-2 py-1 rounded-md border border-amber-500/20 uppercase font-bold tracking-wide">
                              Otimizada
                            </span>
                          )}
                        <button className="text-slate-400 group-hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
                        {showResultDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                    </div>
                  </div>

                  {/* Collapsible Content */}
                  {showResultDetails && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 pt-4">
                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-center group hover:bg-slate-800/80 transition-all relative overflow-hidden">
                          <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                             <Navigation size={40} />
                          </div>
                          <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 flex items-center gap-1.5 tracking-wider relative z-10">
                            <Navigation size={12} className="text-blue-400" /> DISTÂNCIA
                          </div>
                          <div className="flex items-baseline gap-1 relative z-10">
                            <span className="text-3xl font-bold text-white tracking-tight">{result.totalDistanceKm}</span> 
                            <span className="text-xs font-medium text-slate-500">km</span>
                          </div>
                        </div>
                        
                        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-center group hover:bg-slate-800/80 transition-all relative overflow-hidden">
                          <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                             <Clock size={40} />
                          </div>
                          <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 flex items-center gap-1.5 tracking-wider relative z-10">
                            <Clock size={12} className="text-blue-400" /> TEMPO
                          </div>
                          <div className="flex items-baseline gap-1 relative z-10">
                             <span className="text-3xl font-bold text-white tracking-tight">{result.totalDurationMin}</span> 
                             <span className="text-xs font-medium text-slate-500">min</span>
                          </div>
                        </div>
                      </div>

                      {/* Total Price Card */}
                      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 p-6 rounded-2xl mb-6 shadow-xl shadow-indigo-900/30 relative overflow-hidden group transform hover:scale-[1.01] transition-transform">
                        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-24 h-24 bg-black/10 rounded-full blur-xl"></div>
                        
                        <div className="flex justify-between items-center relative z-10">
                            <div>
                                <p className="text-indigo-100/80 text-[10px] font-bold uppercase tracking-widest mb-1">Total Estimado</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg text-indigo-200 font-medium">R$</span>
                                    <span className="text-5xl font-extrabold text-white tracking-tight">{result.estimatedPrice.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-md border border-white/10 shadow-inner">
                                <DollarSign size={28} className="text-white" />
                            </div>
                        </div>
                      </div>

                      {/* Payment Method Selection */}
                      <div className="mb-6">
                          <div className="flex items-center justify-between mb-3 px-1">
                             <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Forma de Pagamento</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => setPaymentMethod('Pix')}
                                className={`relative flex flex-col items-center justify-center gap-2 py-3.5 rounded-xl border transition-all duration-200 overflow-hidden group ${
                                    paymentMethod === 'Pix' 
                                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 border-transparent text-white shadow-lg shadow-indigo-500/30 ring-1 ring-indigo-400/50' 
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600 hover:text-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <QrCode size={18} className={paymentMethod === 'Pix' ? 'text-white' : 'group-hover:text-white transition-colors'} /> 
                                    <span className="font-semibold text-sm">Pix</span>
                                </div>
                                {paymentMethod === 'Pix' && <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>}
                            </button>
                            
                            <button 
                                onClick={() => setPaymentMethod('Dinheiro')}
                                className={`relative flex flex-col items-center justify-center gap-2 py-3.5 rounded-xl border transition-all duration-200 overflow-hidden group ${
                                    paymentMethod === 'Dinheiro' 
                                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 border-transparent text-white shadow-lg shadow-indigo-500/30 ring-1 ring-indigo-400/50' 
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600 hover:text-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Banknote size={18} className={paymentMethod === 'Dinheiro' ? 'text-white' : 'group-hover:text-white transition-colors'} /> 
                                    <span className="font-semibold text-sm">Dinheiro</span>
                                </div>
                                {paymentMethod === 'Dinheiro' && <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>}
                            </button>
                          </div>
                      </div>

                      <button 
                          onClick={handleWhatsAppSend}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-4 px-4 rounded-xl font-bold text-base shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-xl"></div>
                          <Send size={20} className="group-hover:rotate-12 transition-transform duration-300 relative z-10" /> 
                          <span className="relative z-10">ENVIAR NO WHATSAPP</span>
                      </button>
                      
                      <a 
                          href={result.mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-center text-slate-500 text-xs mt-5 hover:text-indigo-400 transition-colors flex items-center justify-center gap-1.5 group py-2"
                        >
                          <span>Ver rota detalhada no Google Maps</span>
                          <Navigation size={10} className="group-hover:translate-x-0.5 transition-transform" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="h-24"></div>
          </div>
        ) : (
          // --- MY PAGE VIEW ---
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 flex flex-col min-h-[500px]">
             <div className="text-center mb-8">
               <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-full mb-3">
                    <Database size={24} className="text-indigo-600" />
               </div>
               <h2 className="text-xl sm:text-2xl font-bold text-indigo-900">Minhas Solicitações</h2>
               <p className="text-sm text-gray-500 mt-1">Acompanhe seu histórico salvo no banco de dados.</p>
             </div>

             <div className="mb-8 flex-1">
               <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                 <h3 className="text-base font-medium text-gray-900">Histórico Recente</h3>
                 <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-bold">
                   {history.length}
                 </span>
               </div>
               
               {history.length === 0 ? (
                 <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <History size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">Nenhum orçamento salvo ainda.</p>
                    <p className="text-gray-400 text-sm mt-1">Gere uma rota para vê-la aqui.</p>
                 </div>
               ) : (
                 <div className="space-y-3">
                   {history.map((item) => (
                     <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow group relative">
                       <div className="flex justify-between items-start mb-3">
                         <div>
                           <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                             {formatDate(item.createdAt)}
                           </p>
                           <h4 className="font-bold text-gray-900">{item.requesterName}</h4>
                         </div>
                         {item.result && (
                           <div className="text-right">
                             <span className="block text-lg font-bold text-indigo-700 leading-none">
                               R$ {item.result.estimatedPrice.toFixed(2)}
                             </span>
                             <span className="text-xs text-gray-500">{item.result.totalDistanceKm} km</span>
                           </div>
                         )}
                       </div>

                       <div className="space-y-1 mb-4">
                         <div className="flex items-start gap-2">
                           <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
                           <p className="text-sm text-gray-600 truncate flex-1">{item.stops[0].address}</p>
                         </div>
                         <div className="flex items-start gap-2">
                           <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>
                           <p className="text-sm text-gray-600 truncate flex-1">{item.stops[1].address}</p>
                           {item.stops.length > 2 && (
                             <span className="text-xs bg-gray-100 text-gray-500 px-1.5 rounded">+{item.stops.length - 2}</span>
                           )}
                         </div>
                       </div>

                       <div className="flex justify-end gap-2 border-t border-gray-50 pt-3">
                         <button 
                           onClick={() => deleteFromHistory(item.id)}
                           className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                           title="Excluir"
                         >
                           <Trash2 size={16} />
                         </button>
                         <button 
                           onClick={() => restoreFromHistory(item)}
                           className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                         >
                           <ReloadIcon size={14} /> Carregar Orçamento
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>

             <div className="mt-auto border-t border-gray-100 pt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button 
                  onClick={() => setCurrentView('home')}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Voltar
                </button>
                <button 
                  onClick={handleNewQuote}
                  className="px-5 py-2.5 bg-indigo-700 text-white font-semibold rounded-lg hover:bg-indigo-800 transition-colors shadow-sm text-sm"
                >
                  Novo Orçamento
                </button>
             </div>
          </div>
        )}

      </main>

      {/* Footer Action - Fixed Bottom (Only on Home) */}
      {currentView === 'home' && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-3 shadow-[0_-5px_25px_-5px_rgba(0,0,0,0.1)] z-30 safe-area-pb">
          <div className="max-w-xl mx-auto">
            <button 
              onClick={handleCalculate}
              disabled={loading}
              className="w-full bg-indigo-700 hover:bg-indigo-800 disabled:bg-gray-400 text-white font-bold text-base sm:text-lg py-3.5 rounded-xl shadow-md flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={20} /> Verificando...
                </>
              ) : (
                <>
                  <RefreshCw size={20} /> CALCULAR AGORA
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-all">
          <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="relative mb-3">
              <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Truck size={18} className="text-indigo-600" />
              </div>
            </div>
            <p className="text-sm font-bold text-indigo-900">Calculando rota...</p>
          </div>
        </div>
      )}

    </div>
  );
}