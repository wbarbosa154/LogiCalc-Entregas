import React from 'react';
import { Stop } from '../types';
import { MapPin, Trash2, ArrowDownUp, FileText } from 'lucide-react';

interface AddressListProps {
  stops: Stop[];
  setStops: React.Dispatch<React.SetStateAction<Stop[]>>;
  onAddressChange: (id: string, value: string) => void;
  onObservationChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
  onSwapP1P2: () => void;
}

const AddressList: React.FC<AddressListProps> = ({ stops, setStops, onAddressChange, onObservationChange, onRemove, onSwapP1P2 }) => {
  
  return (
    <div className="space-y-3 relative">
      {stops.map((stop, index) => {
        const isFirst = index === 0;
        const isSecond = index === 1;
        
        let label = "";
        let borderColor = "";
        let iconColor = "";
        let placeholder = "";

        if (isFirst) {
            label = "PONTO 1 - COLETA";
            borderColor = "border-l-4 border-l-green-500";
            iconColor = "text-green-600";
            placeholder = "Onde retirar?";
        } else if (isSecond) {
            label = "PONTO 2 - ENTREGA";
            borderColor = "border-l-4 border-l-red-500";
            iconColor = "text-red-600";
            placeholder = "Onde entregar?";
        } else {
            label = `PONTO ${index + 1} - ADICIONAL`;
            borderColor = "border-l-4 border-l-blue-400";
            iconColor = "text-blue-500";
            placeholder = "Endereço adicional...";
        }

        return (
          <React.Fragment key={stop.id}>
            <div className={`bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 ${borderColor} transition-all hover:shadow-md relative`}>
              
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 flex items-center gap-1 uppercase tracking-wide truncate">
                  <MapPin size={12} className={iconColor} /> {label}
                </span>
                
                {/* Remove Button for Point 3+ */}
                {!isFirst && !isSecond && (
                  <button 
                    onClick={() => onRemove(stop.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-2 -mr-2"
                    title="Remover parada"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={stop.address}
                    onChange={(e) => onAddressChange(stop.id, e.target.value)}
                    placeholder={placeholder}
                    className="w-full p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm sm:text-base text-gray-800 placeholder-gray-400 transition-all"
                  />
                </div>
                
                <div className="flex items-center gap-2 px-1 pt-1">
                  <FileText size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={stop.observation || ''}
                    onChange={(e) => onObservationChange(stop.id, e.target.value)}
                    placeholder="Observação (opcional)"
                    className="w-full bg-transparent border-b border-dashed border-gray-200 py-1 text-xs sm:text-sm text-gray-600 placeholder-gray-400 focus:border-blue-300 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Swap Button visually placed between P1 and P2 */}
            {isFirst && stops.length >= 2 && (
                <div className="absolute left-0 right-0 -bottom-5 z-10 flex justify-center pointer-events-none">
                    <button 
                        onClick={onSwapP1P2}
                        className="bg-white text-blue-600 border border-gray-200 shadow-sm hover:shadow-md hover:bg-blue-50 p-2 rounded-full transition-all pointer-events-auto transform active:scale-90 duration-200 group"
                        title="Trocar Coleta e Entrega"
                    >
                        <ArrowDownUp size={16} className="group-hover:text-blue-700" />
                    </button>
                </div>
            )}
            
            {/* Spacer to account for the absolute button between 1 and 2 */}
            {isFirst && <div className="h-3"></div>}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default AddressList;