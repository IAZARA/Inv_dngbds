import { useNavigate } from 'react-router-dom';
import type { CaseRecord, EstadoRequerimiento } from '../../types';
import {
  collectContactList,
  collectSocialList,
  computeAge,
  formatOptionText,
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
          const ageLabel = item.persona?.birthdate
            ? computeAge(item.persona.birthdate)
            : item.persona?.age
              ? String(item.persona.age)
              : null;

          const statusClass = statusVariant(item.estadoRequerimiento);

          return (
            <article key={item.id} className={`case-summary case-summary--${statusClass}`}>
              <header className="case-summary__header">
                <div className="case-summary__title">
                  <h3>{(personaFullName || 'Sin persona asociada').toUpperCase()}</h3>
                  {item.persona?.identityNumber && (
                    <p>
                      <strong>Documento:</strong> {item.persona.documentType ?? 'S/D'}{' '}
                      {item.persona.identityNumber}
                    </p>
                  )}
                </div>
                <div className="case-summary__actions">
                  <button
                    className="case-action"
                    type="button"
                    onClick={() => navigate(`/cases/${item.id}`)}
                    title="Ver legajo"
                  >
                    👁
                  </button>
                  <button
                    className="case-action"
                    type="button"
                    onClick={() => onEdit(item)}
                    disabled={!canEdit}
                    title="Editar caso"
                  >
                    ✎
                  </button>
                  <button
                    className="case-action"
                    type="button"
                    onClick={() => onDelete(item)}
                    disabled={!canEdit || isDeleting}
                    title="Eliminar caso"
                  >
                    🗑
                  </button>
                </div>
              </header>

              <div className="case-summary__layout">
                <div className="case-summary__portrait">
                  {primaryPhoto ? (
                    <img src={primaryPhoto.url} alt={primaryPhoto.description ?? 'Foto principal'} />
                  ) : (
                    <span>Sin foto</span>
                  )}
                  <span className={`case-status case-status--${statusClass}`}>{statusLabel}</span>
                </div>

                <div className="case-summary__info">
                  <div>
                    {ageLabel && (
                      <p>
                        <strong>Edad:</strong> {ageLabel} años
                      </p>
                    )}
                    {item.persona?.sex && (
                      <p>
                        <strong>Género:</strong> {sanitizeValue(item.persona.sex) ?? item.persona.sex}
                      </p>
                    )}
                    {numeroCausa && (
                      <p>
                        <strong>Expediente:</strong> {numeroCausa}
                      </p>
                    )}
                    {caratula && (
                      <p>
                        <strong>Carátula:</strong> {caratula}
                      </p>
                    )}
                    {delito && (
                      <p>
                        <strong>Delito:</strong> {delito}
                      </p>
                    )}
                  </div>

                  <div>
                    {jurisdiccion && (
                      <p>
                        <strong>Jurisdicción:</strong> {jurisdiccion}
                      </p>
                    )}
                    {fuerza && (
                      <p>
                        <strong>Fuerza asignada:</strong> {fuerza}
                      </p>
                    )}
                    {fechaHecho && (
                      <p>
                        <strong>Fecha del hecho:</strong> {fechaHecho}
                      </p>
                    )}
                    {item.recompensa === 'SI' && rewardAmount && (
                      <p>
                        <strong>Recompensa:</strong> ${rewardAmount}
                      </p>
                    )}
                    <p>
                      <strong>Archivos:</strong> {item.photos.length} foto(s) · {item.documents.length} documento(s)
                    </p>
                  </div>

                  <div>
                    <p>
                      <strong>Fecha de registro:</strong> {new Date(item.creadoEn).toLocaleDateString()}
                    </p>
                    <p>
                      <strong>Última actualización:</strong> {new Date(item.actualizadoEn).toLocaleDateString()}
                    </p>
                    {phoneList.length > 0 && (
                      <p>
                        <strong>Teléfonos:</strong> {phoneList.join(' · ')}
                      </p>
                    )}
                    {emailList.length > 0 && (
                      <p>
                        <strong>Emails:</strong> {emailList.join(' · ')}
                      </p>
                    )}
                    {socialList.length > 0 && (
                      <p>
                        <strong>Redes:</strong> {socialList.join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default CasesList;
