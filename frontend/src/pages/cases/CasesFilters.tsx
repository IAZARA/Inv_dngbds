import type { ChangeEvent } from 'react';

import type { EstadoRequerimiento } from '../../types';
import {
  estadoRequerimientoOptions,
  fuerzaIntervinienteOptions,
  jurisdiccionOptions
} from './constants';
import type { CaseFormValues } from './formSchema';
import { formatOptionText, translateEstado } from './helpers';

type JurisdiccionFilter = 'TODAS' | CaseFormValues['jurisdiccion'];
type FuerzaFilter = 'TODAS' | CaseFormValues['fuerzaAsignada'];

type CasesFiltersProps = {
  searchTerm: string;
  estadoFilter: 'TODOS' | EstadoRequerimiento;
  jurisdiccionFilter: JurisdiccionFilter;
  fuerzaFilter: FuerzaFilter;
  onSearchChange: (value: string) => void;
  onEstadoChange: (value: 'TODOS' | EstadoRequerimiento) => void;
  onJurisdiccionChange: (value: JurisdiccionFilter) => void;
  onFuerzaChange: (value: FuerzaFilter) => void;
  onClear: () => void;
};

const CasesFilters = ({
  searchTerm,
  estadoFilter,
  jurisdiccionFilter,
  fuerzaFilter,
  onSearchChange,
  onEstadoChange,
  onJurisdiccionChange,
  onFuerzaChange,
  onClear
}: CasesFiltersProps) => {
  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  const handleEstado = (event: ChangeEvent<HTMLSelectElement>) => {
    onEstadoChange(event.target.value as 'TODOS' | EstadoRequerimiento);
  };

  const handleJurisdiccion = (event: ChangeEvent<HTMLSelectElement>) => {
    onJurisdiccionChange(event.target.value as JurisdiccionFilter);
  };

  const handleFuerza = (event: ChangeEvent<HTMLSelectElement>) => {
    onFuerzaChange(event.target.value as FuerzaFilter);
  };

  const isClearDisabled =
    !searchTerm && estadoFilter === 'TODOS' && jurisdiccionFilter === 'TODAS' && fuerzaFilter === 'TODAS';

  return (
    <section className="card">
      <h3>Filtrar casos</h3>
      <div
        className="form-grid"
        style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          Búsqueda
          <input
            type="text"
            placeholder="Número de causa, carátula o persona"
            value={searchTerm}
            onChange={handleSearch}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          Estado
          <select value={estadoFilter} onChange={handleEstado}>
            <option value="TODOS">Todos los estados</option>
            {estadoRequerimientoOptions.map((option) => (
              <option key={option} value={option}>
                {translateEstado(option)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          Jurisdicción
          <select value={jurisdiccionFilter} onChange={handleJurisdiccion}>
            <option value="TODAS">Todas las jurisdicciones</option>
            {jurisdiccionOptions.map((option) => (
              <option key={option} value={option}>
                {formatOptionText(option)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          Fuerza asignada
          <select value={fuerzaFilter} onChange={handleFuerza}>
            <option value="TODAS">Todas las fuerzas</option>
            {fuerzaIntervinienteOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button type="button" className="btn ghost" onClick={onClear} disabled={isClearDisabled}>
          Limpiar filtros
        </button>
      </div>
    </section>
  );
};

export default CasesFilters;
