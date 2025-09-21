import { useNavigate } from 'react-router-dom';
import type { CaseRecord, EstadoRequerimiento } from '../../types';
import {
  collectContactList,
  collectSocialList,
  computeAge,
  formatOptionText,
  formatPersonSummary,
  translateEstado
} from './helpers';

type CasesListProps = {
  isLoading: boolean;
  isError: boolean;
  cases: CaseRecord[];
  filteredCases: CaseRecord[];
  canEdit: boolean;
  onEdit: (record: CaseRecord) => void;
  onDelete: (record: CaseRecord) => void;
  deleteInProgressId: string | null;
};

const CasesList = ({
  isLoading,
  isError,
  cases,
  filteredCases,
  canEdit,
  onEdit,
  onDelete,
  deleteInProgressId
}: CasesListProps) => {
  const navigate = useNavigate();

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
      </section>
    );
  }

  if (filteredCases.length === 0) {
    return (
      <section className="card">
        <h3>Casos cargados</h3>
        <p>No se encontraron casos con los filtros seleccionados.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>Casos cargados</h3>
      <div className="cases-summary-list">
        {filteredCases.map((item) => {
          const phoneList = collectContactList(item.persona?.phone ?? null, item.persona?.phones);
          const emailList = collectContactList(item.persona?.email ?? null, item.persona?.emails);
          const socialList = collectSocialList(item.persona?.socialNetworks);
          const isDeleting = deleteInProgressId === item.id;
          const primaryPhoto = item.photos.find((photo) => photo.isPrimary);
          const statusLabel = translateEstado(item.estadoRequerimiento);
          const personaFullName = [item.persona?.firstName, item.persona?.lastName]
            .filter(Boolean)
            .join(' ');
          const hasPersona = Boolean(personaFullName);
          const delito = sanitizeValue(item.delito);
          const fuerza = sanitizeValue(item.fuerzaAsignada);
          const formattedJurisdiccion = formatOptionText(item.jurisdiccion);
          const jurisdiccion = formattedJurisdiccion === 'Sin dato'
            ? null
            : sanitizeValue(formattedJurisdiccion);
          const caratula = sanitizeValue(item.caratula);
          const numeroCausa = sanitizeValue(item.numeroCausa);
          const rewardAmount = sanitizeValue(item.rewardAmount ?? null);
          const fechaHecho = item.fechaHecho ? new Date(item.fechaHecho).toLocaleDateString() : null;

          return (
            <article key={item.id} className="case-summary">
              <header className="case-summary__header">
                <div className="case-summary__identity">
                  <div className="case-summary__name-block">
                    {primaryPhoto && (
                      <div className="case-summary__avatar">
                        <img src={primaryPhoto.url} alt={primaryPhoto.description ?? 'Foto principal'} />
                      </div>
                    )}
                    <div>
                      <h4>
                        {hasPersona ? personaFullName : 'Sin persona asociada'}
                      </h4>
                      <div className="case-summary__meta">
                        {numeroCausa && <span>Expediente: {numeroCausa}</span>}
                        {item.persona?.identityNumber && (
                          <span>Documento: {item.persona.identityNumber}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className={`case-status case-status--${statusVariant(item.estadoRequerimiento)}`}>
                  {statusLabel}
                </div>
              </header>
              <div className="case-summary__body">
                <div className="case-summary__info">
                  {delito && <span className="case-chip case-chip--delito">{delito}</span>}
                  {caratula && <span className="case-chip">Carátula: {caratula}</span>}
                  {fuerza && <span className="case-chip">Fuerza: {fuerza}</span>}
                  {jurisdiccion && <span className="case-chip">Jurisdicción: {jurisdiccion}</span>}
                  {fechaHecho && <span className="case-chip">Hecho: {fechaHecho}</span>}
                  {item.recompensa === 'SI' && rewardAmount && (
                    <span className="case-chip case-chip--reward">Recompensa: ${rewardAmount}</span>
                  )}
                </div>
                <div className="case-summary__details">
                  {item.persona ? (
                    <>
                      <p className="muted">{formatPersonSummary(item.persona)}</p>
                      <div className="case-summary__contact">
                        {phoneList.length > 0 && (
                          <span>Tel: {phoneList.join(' · ')}</span>
                        )}
                        {emailList.length > 0 && (
                          <span>Email: {emailList.join(' · ')}</span>
                        )}
                        {socialList.length > 0 && (
                          <span>Redes: {socialList.join(' · ')}</span>
                        )}
                      </div>
                      <div className="case-summary__tagline">
                        {item.persona.sex && <span className="tag">{item.persona.sex}</span>}
                        {item.persona.documentType && (
                          <span className="tag">
                            {item.persona.documentType}
                            {item.persona.documentName ? ` • ${item.persona.documentName}` : ''}
                          </span>
                        )}
                        {item.persona.birthdate && (
                          <span className="tag">
                            {new Date(item.persona.birthdate).toLocaleDateString()} ({
                              item.persona.age ?? computeAge(item.persona.birthdate)
                            } años)
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="muted">Sin persona asociada al caso.</p>
                  )}
                </div>
              </div>
              <footer className="case-summary__footer">
                <div className="case-summary__timestamps">
                  <span>Creado: {new Date(item.creadoEn).toLocaleDateString()}</span>
                  <span>Actualizado: {new Date(item.actualizadoEn).toLocaleDateString()}</span>
                  <span>
                    Archivos: {item.photos.length} foto(s) · {item.documents.length} documento(s)
                  </span>
                </div>
                <div className="actions">
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => navigate(`/cases/${item.id}`)}
                  >
                    Ver legajo
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => onEdit(item)}
                    disabled={!canEdit}
                  >
                    Editar
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => onDelete(item)}
                    disabled={!canEdit || isDeleting}
                  >
                    {isDeleting ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default CasesList;
