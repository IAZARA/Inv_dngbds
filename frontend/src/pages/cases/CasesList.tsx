import type { CaseRecord } from '../../types';
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
      <div className="records-list">
        {filteredCases.map((item) => {
          const phoneList = collectContactList(item.persona?.phone ?? null, item.persona?.phones);
          const emailList = collectContactList(item.persona?.email ?? null, item.persona?.emails);
          const socialList = collectSocialList(item.persona?.socialNetworks);
          const isDeleting = deleteInProgressId === item.id;

          return (
            <article key={item.id} className="record-item">
              <header>
                <div>
                  <h4>{item.numeroCausa ?? 'Caso sin número'}</h4>
                  <p className="muted">
                    Estado: {translateEstado(item.estadoRequerimiento)} | Fuerza: {item.fuerzaAsignada ?? 'S/D'}
                  </p>
                  <p className="muted">
                    Jurisdicción: {formatOptionText(item.jurisdiccion)} | Carátula: {item.caratula ?? 'Sin dato'}
                  </p>
                </div>
                <div className="actions">
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
              </header>
              <p className="muted">
                Fecha del hecho: {item.fechaHecho ? new Date(item.fechaHecho).toLocaleDateString() : 'Sin dato'}
              </p>
              <p className="muted">
                Recompensa: {formatOptionText(item.recompensa)}{' '}
                {item.recompensa === 'SI' && item.rewardAmount ? `· $${item.rewardAmount}` : ''}
              </p>
              <p className="muted">
                Archivos: {item.photos.length} foto(s) · {item.documents.length} documento(s)
              </p>
              {item.persona ? (
                <div className="details-list">
                  <div>
                    <strong>
                      {item.persona.firstName} {item.persona.lastName}
                    </strong>{' '}
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
                  <p className="muted">{formatPersonSummary(item.persona)}</p>
                  {phoneList.length > 0 && (
                    <p className="muted">Teléfonos: {phoneList.join(' · ')}</p>
                  )}
                  {emailList.length > 0 && (
                    <p className="muted">Emails: {emailList.join(' · ')}</p>
                  )}
                  {socialList.length > 0 && (
                    <p className="muted">Redes: {socialList.join(' · ')}</p>
                  )}
                  {item.persona.notes && <p className="muted">Notas: {item.persona.notes}</p>}
                </div>
              ) : (
                <p className="muted">Sin persona asociada.</p>
              )}
              <p className="muted">
                Creado: {new Date(item.creadoEn).toLocaleString()} | Actualizado:{' '}
                {new Date(item.actualizadoEn).toLocaleString()}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default CasesList;
