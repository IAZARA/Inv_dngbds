import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { CaseMediaItem, CaseRecord, EstadoRequerimiento } from '../types';
import {
  collectContactList,
  collectSocialList,
  computeAge,
  formatOptionText,
  translateEstado
} from './cases/helpers';

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

const formatCurrency = (value?: string | null) => {
  if (!value) return null;
  const sanitized = Number(value);
  if (Number.isNaN(sanitized)) return value;
  return sanitized.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
};

const CaseDetailPage = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const caseQuery = useQuery({
    queryKey: ['case', caseId],
    enabled: Boolean(caseId),
    queryFn: async () => {
      const { data } = await api.get<{ case: CaseRecord }>(`/cases/${caseId}`);
      return data.case;
    }
  });

  const isLoading = caseQuery.isLoading;
  const isError = caseQuery.isError;
  const caseRecord = caseQuery.data;

  const persona = caseRecord?.persona ?? null;

  const primaryPhoto: CaseMediaItem | null = useMemo(() => {
    if (!caseRecord) return null;
    return caseRecord.photos.find((photo) => photo.isPrimary) ?? caseRecord.photos[0] ?? null;
  }, [caseRecord]);

  const otherPhotos = useMemo(() => {
    if (!caseRecord || !caseRecord.photos.length) return [];
    return caseRecord.photos.filter((photo) => primaryPhoto && photo.id !== primaryPhoto.id);
  }, [caseRecord, primaryPhoto]);

  const phoneList = persona
    ? collectContactList(persona.phone ?? null, persona.phones)
    : [];
  const emailList = persona
    ? collectContactList(persona.email ?? null, persona.emails)
    : [];
  const socialList = persona ? collectSocialList(persona.socialNetworks) : [];

  if (!caseId) {
    return <div className="error">Caso no especificado.</div>;
  }

  if (isLoading) {
    return <div className="page"><p>Cargando legajo...</p></div>;
  }

  if (isError || !caseRecord) {
    return (
      <div className="page">
        <div className="error">No se pudo cargar el caso solicitado.</div>
      </div>
    );
  }

  const numeroCausa = sanitizeValue(caseRecord.numeroCausa);
  const caratula = sanitizeValue(caseRecord.caratula);
  const delito = sanitizeValue(caseRecord.delito);
  const fuerza = sanitizeValue(caseRecord.fuerzaAsignada);
  const formattedJurisdiccion = formatOptionText(caseRecord.jurisdiccion);
  const jurisdiccion = formattedJurisdiccion === 'Sin dato' ? null : sanitizeValue(formattedJurisdiccion);
  const juzgado = sanitizeValue(caseRecord.juzgadoInterventor);
  const secretaria = sanitizeValue(caseRecord.secretaria);
  const fiscalia = sanitizeValue(caseRecord.fiscalia);
  const rewardAmount = caseRecord.recompensa === 'SI' ? formatCurrency(caseRecord.rewardAmount) : null;
  const fechaHecho = caseRecord.fechaHecho
    ? new Date(caseRecord.fechaHecho).toLocaleDateString()
    : null;
  const createdAt = new Date(caseRecord.creadoEn).toLocaleString();
  const updatedAt = new Date(caseRecord.actualizadoEn).toLocaleString();

  const personaFullName = [persona?.firstName, persona?.lastName]
    .filter(Boolean)
    .join(' ');

  const birthdateLabel = persona?.birthdate
    ? `${new Date(persona.birthdate).toLocaleDateString()} (${persona.age ?? computeAge(persona.birthdate)} años)`
    : null;

  const nationalityText = persona?.nationality === 'OTRO'
    ? sanitizeValue(persona.otherNationality)
    : persona?.nationality === 'ARGENTINA'
      ? 'Argentina'
      : null;

  const addressPieces: string[] = [];
  if (sanitizeValue(persona?.street) || sanitizeValue(persona?.streetNumber)) {
    addressPieces.push(
      [sanitizeValue(persona?.street) ?? '', sanitizeValue(persona?.streetNumber) ?? '']
        .filter(Boolean)
        .join(' ')
    );
  }
  if (sanitizeValue(persona?.locality) || sanitizeValue(persona?.province)) {
    addressPieces.push(
      [sanitizeValue(persona?.locality) ?? '', sanitizeValue(persona?.province) ?? '']
        .filter(Boolean)
        .join(', ')
    );
  }
  if (sanitizeValue(persona?.reference)) {
    addressPieces.push(`Referencia: ${sanitizeValue(persona?.reference)}`);
  }
  const address = addressPieces.length ? addressPieces.join(' · ') : null;

  const additionalInfo = caseRecord.additionalInfo.filter(
    (entry) => sanitizeValue(entry.label) && sanitizeValue(entry.value)
  );

  return (
    <div className="page case-detail">
      <div className="page-header">
        <div>
          <h2>{personaFullName || 'Caso sin persona asociada'}</h2>
          {numeroCausa && <p>Expediente: {numeroCausa}</p>}
        </div>
        <div className="case-detail__header-actions">
          <div className={`case-status case-status--${statusVariant(caseRecord.estadoRequerimiento)}`}>
            {translateEstado(caseRecord.estadoRequerimiento)}
          </div>
          <button className="btn ghost" type="button" onClick={() => navigate('/cases')}>
            Volver
          </button>
        </div>
      </div>

      <section className="case-detail__hero card">
        {primaryPhoto ? (
          <figure className="case-detail__photo">
            <img src={primaryPhoto.url} alt={primaryPhoto.description ?? 'Foto principal'} />
            <figcaption>Foto principal del legajo</figcaption>
          </figure>
        ) : (
          <div className="case-detail__photo case-detail__photo--placeholder">
            <span>Sin foto principal</span>
          </div>
        )}
        <div className="case-detail__summary">
          {delito && <span className="case-chip case-chip--delito">{delito}</span>}
          {caratula && <span className="case-chip">Carátula: {caratula}</span>}
          {fuerza && <span className="case-chip">Fuerza: {fuerza}</span>}
          {jurisdiccion && <span className="case-chip">Jurisdicción: {jurisdiccion}</span>}
          {fechaHecho && <span className="case-chip">Hecho: {fechaHecho}</span>}
          {caseRecord.recompensa === 'SI' && rewardAmount && (
            <span className="case-chip case-chip--reward">Recompensa: {rewardAmount}</span>
          )}
          <div className="case-detail__timestamps">
            <span>Creado: {createdAt}</span>
            <span>Actualizado: {updatedAt}</span>
          </div>
        </div>
      </section>

      <section className="case-detail__grid">
        <div className="case-detail__section card">
          <h3>Datos del caso</h3>
          <dl className="case-detail__list">
            {numeroCausa && (
              <div>
                <dt>Número de expediente</dt>
                <dd>{numeroCausa}</dd>
              </div>
            )}
            {juzgado && (
              <div>
                <dt>Juzgado interventor</dt>
                <dd>{juzgado}</dd>
              </div>
            )}
            {secretaria && (
              <div>
                <dt>Secretaría</dt>
                <dd>{secretaria}</dd>
              </div>
            )}
            {fiscalia && (
              <div>
                <dt>Fiscalía</dt>
                <dd>{fiscalia}</dd>
              </div>
            )}
            {caseRecord.recompensa === 'SI' && rewardAmount && (
              <div>
                <dt>Monto de recompensa</dt>
                <dd>{rewardAmount}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="case-detail__section card">
          <h3>Datos personales</h3>
          <dl className="case-detail__list">
            {personaFullName && (
              <div>
                <dt>Nombre completo</dt>
                <dd>{personaFullName}</dd>
              </div>
            )}
            {persona?.identityNumber && (
              <div>
                <dt>Documento</dt>
                <dd>
                  {persona.identityNumber}
                  {persona.documentType && ` · ${persona.documentType}`}
                  {persona.documentName && ` (${persona.documentName})`}
                </dd>
              </div>
            )}
            {birthdateLabel && (
              <div>
                <dt>Fecha de nacimiento</dt>
                <dd>{birthdateLabel}</dd>
              </div>
            )}
            {nationalityText && (
              <div>
                <dt>Nacionalidad</dt>
                <dd>{nationalityText}</dd>
              </div>
            )}
            {address && (
              <div>
                <dt>Domicilio</dt>
                <dd>{address}</dd>
              </div>
            )}
            {persona?.notes && sanitizeValue(persona.notes) && (
              <div>
                <dt>Notas</dt>
                <dd>{persona.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {(phoneList.length > 0 || emailList.length > 0 || socialList.length > 0) && (
        <section className="case-detail__section card">
          <h3>Contactos</h3>
          <ul className="case-detail__list case-detail__list--plain">
            {phoneList.length > 0 && <li>Teléfonos: {phoneList.join(' · ')}</li>}
            {emailList.length > 0 && <li>Emails: {emailList.join(' · ')}</li>}
            {socialList.length > 0 && <li>Redes: {socialList.join(' · ')}</li>}
          </ul>
        </section>
      )}

      {additionalInfo.length > 0 && (
        <section className="case-detail__section card">
          <h3>Información complementaria</h3>
          <dl className="case-detail__list">
            {additionalInfo.map((entry) => (
              <div key={entry.label}>
                <dt>{entry.label}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {otherPhotos.length > 0 && (
        <section className="case-detail__section card">
          <h3>Galería de fotos</h3>
          <div className="case-detail__gallery">
            {otherPhotos.map((photo) => (
              <figure key={photo.id}>
                <img src={photo.url} alt={photo.description ?? 'Foto del caso'} />
                {photo.description && <figcaption>{photo.description}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      {caseRecord.documents.length > 0 && (
        <section className="case-detail__section card">
          <h3>Documentos adjuntos</h3>
          <ul className="case-detail__documents">
            {caseRecord.documents.map((doc) => (
              <li key={doc.id}>
                <a href={doc.url} target="_blank" rel="noreferrer">
                  {doc.description ?? doc.originalName}
                </a>
                <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default CaseDetailPage;
