import React from 'react';
import { ReceivedUnitRecord } from '../types';
import { Package, Calendar, Droplets, CheckCircle, XCircle, Trash2, User } from 'lucide-react';

interface RecepcionRecordCardProps {
  record: ReceivedUnitRecord;
  onDelete: (id: string) => void;
  currentUserUid?: string;
}

export const RecepcionRecordCard: React.FC<RecepcionRecordCardProps> = ({ record, onDelete, currentUserUid }) => {
  const isOwner = currentUserUid === record.uid;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow relative">
      {isOwner && (
        <button
          onClick={() => record.id && onDelete(record.id)}
          className="absolute top-6 right-6 text-zinc-400 hover:text-red-500 transition-colors"
          title="Eliminar registro"
        >
          <Trash2 size={20} />
        </button>
      )}

      <div className="flex items-start gap-4 mb-6">
        <div className={`p-3 rounded-2xl ${record.accepted === 'Sí' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
          <Package size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-zinc-900">Bolsa: {record.unitId}</h3>
          <p className="text-sm text-zinc-600 font-medium mb-1">Sello: {record.qualitySeal}</p>
          <p className="text-zinc-500 flex items-center gap-2">
            <Calendar size={14} />
            {record.receptionDate} {record.receptionTime}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-50 p-3 rounded-xl">
          <p className="text-xs text-zinc-500 mb-1">Tipo</p>
          <p className="font-semibold text-zinc-800">{record.hemoderivativeType}</p>
        </div>
        <div className="bg-zinc-50 p-3 rounded-xl">
          <p className="text-xs text-zinc-500 mb-1">Grupo y Rh</p>
          <p className="font-bold text-red-600 flex items-center gap-1">
            <Droplets size={14} />
            {record.bloodGroup}{record.rh}
          </p>
        </div>
        <div className="bg-zinc-50 p-3 rounded-xl">
          <p className="text-xs text-zinc-500 mb-1">Proveedor</p>
          <p className="font-semibold text-zinc-800">{record.provider}</p>
        </div>
        <div className="bg-zinc-50 p-3 rounded-xl">
          <p className="text-xs text-zinc-500 mb-1">Vencimiento</p>
          <p className="font-semibold text-zinc-800">{record.expirationDate}</p>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-zinc-500">Estado de Recepción</span>
          {record.accepted === 'Sí' ? (
            <span className="flex items-center gap-1 text-sm font-bold text-green-600">
              <CheckCircle size={16} /> Aceptado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm font-bold text-red-600">
              <XCircle size={16} /> Rechazado
            </span>
          )}
        </div>
        
        {record.accepted === 'No' && record.rejectionReason && (
          <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-100">
            <p className="text-sm text-red-800"><span className="font-bold">Motivo:</span> {record.rejectionReason}</p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
          <User size={12} />
          <span>Registrado por: {record.userEmail || 'Desconocido'}</span>
        </div>
      </div>
    </div>
  );
};
