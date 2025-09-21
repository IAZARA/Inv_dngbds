import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CaseRecord, EstadoRequerimiento } from '../../types';
import { formatOptionText, translateEstado } from './helpers';

type CasesListProps = {
  isLoading: boolean;
  isError: boolean;
  cases: CaseRecord[];
  filteredCases: CaseRecord[];
  paginatedCases: CaseRecord[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (record: CaseRecord) => void;
  onDelete: (record: CaseRecord) => void;
  deleteInProgressId: string | null;
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onCreate: () => void;
  selectMode: boolean;
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
};

const CasesList = ({
  isLoading,
  isError,
  cases,
  filteredCases,
  paginatedCases,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  deleteInProgressId,
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onCreate,
  selectMode,
  selectedIds,
  onToggleSelection
}: CasesListProps) => {
  const navigate = useNavigate();
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  const closeActionsMenu = () => setOpenActionsId(null);

  const handleToggleActions = (id: string) => {
    setOpenActionsId((current) => (current === id ? null : id));
  };

  const handleViewDetails = (id: string) => {
    closeActionsMenu();
    navigate(`/cases/${id}`);
  };

  const handleEdit = (record: CaseRecord) => {
    closeActionsMenu();
    onEdit(record);
  };

  const handleDelete = (record: CaseRecord) => {
    closeActionsMenu();
    onDelete(record);
  };

  const sanitizeValue = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.toUpperCase();
    if (
      normalized === 'SIN DATO' ||
      normalized === 'SIN_DATO' ||
      normalized === 'SIN_DATOS' ||
      normalized === 'S/D' ||
      normalized === '0'
    ) {
      return null;
    }
    return trimmed;
  };

  const statusVariant = (estado: EstadoRequerimiento) => {
    switch (estado) {
      case 'CAPTURA_VIGENTE':
        return 'danger';
      case 'SIN_EFECTO':
        return 'warning';
      case 'DETENIDO':
      default:
        return 'success';
    }
  };

  if (isLoading) {
    return (
      <section className="card">
        <h3>Casos cargados</h3>
        <p>Cargando casos...</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="card">
        <h3>Casos cargados</h3>
        <p className="error">No se pudo cargar el listado.</p>
      </section>
    );
  }

  if (cases.length === 0) {
    return (
      <section className="card">
        <h3>Casos cargados</h3>
        <p>No hay casos registrados.</p>
        {canEdit && (
          <div className="empty-state">
            <button className="btn primary" type="button" onClick={onCreate}>
              + Crear caso
            </button>
          </div>
        )}
      </section>
    );
  }

  if (filteredCases.length === 0) {
    return (
      <section className="card">
        <h3>Casos cargados</h3>
        <p>No se encontraron casos con los filtros seleccionados.</p>
        {canEdit && (
          <div className="empty-state">
            <button className="btn primary" type="button" onClick={onCreate}>
              + Crear caso
            </button>
          </div>
        )}
      </section>
    );
  }

  const items = paginatedCases.length > 0 ? paginatedCases : filteredCases;

  const firstItemIndex = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItemIndex = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);

  return (
    <section className="card">
      <header className="case-list__header">
        <h3>Casos cargados</h3>
        <p>
          Mostrando {firstItemIndex}-{lastItemIndex} de {totalItems} casos
        </p>
      </header>
      <div className="cases-summary-list">
        {items.map((item) => {
          const isDeleting = deleteInProgressId === item.id;
          const statusLabel = translateEstado(item.estadoRequerimiento);
          const personaFullName = [item.persona?.firstName, item.persona?.lastName]
            .filter(Boolean)
            .join(' ');
          const fuerza = sanitizeValue(item.fuerzaAsignada ?? 'S/D');
          const formattedJurisdiccion = formatOptionText(item.jurisdiccion);
          const jurisdiccion = formattedJurisdiccion === 'Sin dato'
            ? null
            : sanitizeValue(formattedJurisdiccion);
          const numeroCausa = sanitizeValue(item.numeroCausa);
          const statusClass = statusVariant(item.estadoRequerimiento);

          const isSelected = selectedIds.includes(item.id);

          return (
            <article
              key={item.id}
              className={`case-row case-row--${statusClass}${isSelected ? ' is-selected' : ''}`}
            >
              <div className="case-row__left">
                {selectMode && (
                  <label className="case-row__checkbox">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelection(item.id)}
                    />
                    <span>{isSelected ? 'Seleccionado' : 'Seleccionar'}</span>
                  </label>
                )}
                <span className={`case-row__badge case-row__badge--${statusClass}`}>{statusLabel}</span>
                <div className="case-row__main">
                  <h4>{personaFullName || 'Sin persona asociada'}</h4>
                  <p className="case-row__meta">
                    {numeroCausa
                      ? `Expediente ${numeroCausa}`
                      : jurisdiccion
                        ? `Jurisdicción ${jurisdiccion}`
                        : 'Sin referencia'}
                  </p>
                </div>
              </div>
              <div className="case-row__center">
                <p>
                  <strong>Estado:</strong> {statusLabel}
                </p>
                <p>
                  <strong>Fuerza:</strong> {fuerza ?? 'S/D'}
                </p>
              </div>
              <div className="case-row__actions case-row__actions--desktop">
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => handleViewDetails(item.id)}
                >
                  Ver detalles
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => handleEdit(item)}
                  disabled={!canEdit || selectMode}
                >
                  Editar
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={!canDelete || isDeleting || selectMode}
                >
                  {isDeleting ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
              <div className="case-row__actions case-row__actions--mobile">
                <button
                  type="button"
                  className={`case-row__mobile-toggle${openActionsId === item.id ? ' is-open' : ''}`}
                  onClick={() => handleToggleActions(item.id)}
                  aria-expanded={openActionsId === item.id}
                  aria-controls={`case-actions-${item.id}`}
                  aria-label="Mostrar acciones"
                >
                  <span aria-hidden="true">⋯</span>
                </button>
                <div
                  id={`case-actions-${item.id}`}
                  className={`case-row__mobile-menu${openActionsId === item.id ? ' is-open' : ''}`}
                >
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => handleViewDetails(item.id)}
                  >
                    Ver detalles
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => handleEdit(item)}
                    disabled={!canEdit || selectMode}
                  >
                    Editar
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={!canDelete || isDeleting || selectMode}
                  >
                    {isDeleting ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {totalPages > 1 && (
        <footer className="case-pagination">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            ←
          </button>
          <div className="pagination-pages">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={`pagination-btn${pageNumber === page ? ' is-active' : ''}`}
                onClick={() => onPageChange(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
          >
            →
          </button>
        </footer>
      )}
    </section>
  );
};

export default CasesList;
