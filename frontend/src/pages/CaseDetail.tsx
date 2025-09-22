import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, resolveAssetUrl } from '../lib/api';
import type { CaseAddressEntry, CaseMediaItem, CaseRecord, EstadoRequerimiento } from '../types';
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

const formatCurrency = (value?: string | null) => {
  if (!value) return null;
  const sanitized = Number(value);
  if (Number.isNaN(sanitized)) return value;
  return sanitized.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
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
  const [downloading, setDownloading] = useState(false);
  const [zipDownloading, setZipDownloading] = useState(false);

  const persona = caseRecord?.persona ?? null;
  const statusClass = caseRecord ? statusVariant(caseRecord.estadoRequerimiento) : 'danger';
  const statusLabel = caseRecord ? translateEstado(caseRecord.estadoRequerimiento) : '';

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
    return (
      <div className="page case-detail">
        <p>Cargando legajo...</p>
      </div>
    );
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
  const hasReward = caseRecord.recompensa === 'SI';
  const rewardAmountValue = hasReward && caseRecord.rewardAmount
    ? formatCurrency(caseRecord.rewardAmount)
    : null;
  const rewardLabel = hasReward
    ? rewardAmountValue ?? 'Monto no confirmado'
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

  const formatAddress = (address: CaseAddressEntry) => {
    const parts = [
      sanitizeValue(address.street),
      sanitizeValue(address.streetNumber),
      sanitizeValue(address.locality),
      sanitizeValue(address.province)
    ].filter(Boolean);
    return parts.join(', ');
  };

  const buildLegacyAddress = () => {
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
    return addressPieces.length ? addressPieces.join(' · ') : null;
  };

  const addresses = persona?.addresses && persona.addresses.length > 0
    ? persona.addresses
    : null;
  const legacyAddress = buildLegacyAddress();

  const additionalInfo = caseRecord.additionalInfo.filter(
    (entry) => sanitizeValue(entry.label) && sanitizeValue(entry.value)
  );

  type Highlight = { label: string; value: string };

  const personaNotes = persona?.notes && sanitizeValue(persona.notes) ? persona.notes : null;

  const personalHighlights: Highlight[] = [];

  if (personaFullName) {
    personalHighlights.push({
      label: 'Nombre completo',
      value: personaFullName
    });
  }

  if (persona?.identityNumber) {
    personalHighlights.push({
      label: 'Documento',
      value: `${persona.documentType ?? 'S/D'} ${persona.identityNumber}`
    });
  }

  if (birthdateLabel) {
    personalHighlights.push({
      label: 'Fecha de nacimiento',
      value: birthdateLabel
    });
  }

  if (nationalityText) {
    personalHighlights.push({
      label: 'Nacionalidad',
      value: nationalityText
    });
  }

  if (addresses) {
    addresses.forEach((address, index) => {
      const label = addresses.length === 1
        ? 'Domicilio'
        : index === 0
          ? 'Domicilios'
          : '';

      const isPrincipal = address.isPrincipal;
      const formattedAddress = formatAddress(address);
      const reference = sanitizeValue(address.reference);

      if (formattedAddress) {
        let value = isPrincipal ? `📍 [PRINCIPAL] ${formattedAddress}` : `📍 ${formattedAddress}`;
        if (reference) {
          value += `\nReferencia: ${reference}`;
        }

        personalHighlights.push({
          label,
          value
        });
      }
    });
  } else if (legacyAddress) {
    personalHighlights.push({
      label: 'Domicilio',
      value: legacyAddress
    });
  }

  const caseHighlights: Highlight[] = [];

  if (statusLabel) {
    caseHighlights.push({
      label: 'Estado del requerimiento',
      value: statusLabel
    });
  }

  if (numeroCausa) {
    caseHighlights.push({
      label: 'Número de expediente',
      value: numeroCausa
    });
  }

  if (caratula) {
    caseHighlights.push({
      label: 'Carátula',
      value: caratula
    });
  }

  if (delito) {
    caseHighlights.push({
      label: 'Delito principal',
      value: delito
    });
  }

  if (jurisdiccion) {
    caseHighlights.push({
      label: 'Jurisdicción',
      value: jurisdiccion
    });
  }

  if (fuerza) {
    caseHighlights.push({
      label: 'Fuerza asignada',
      value: fuerza
    });
  }


  if (juzgado) {
    caseHighlights.push({
      label: 'Juzgado interventor',
      value: juzgado
    });
  }

  if (secretaria) {
    caseHighlights.push({
      label: 'Secretaría',
      value: secretaria
    });
  }

  if (fiscalia) {
    caseHighlights.push({
      label: 'Fiscalía',
      value: fiscalia
    });
  }

  if (hasReward) {
    caseHighlights.push({
      label: 'Recompensa',
      value: rewardLabel ?? 'Sí'
    });
  }

  const hasContactInfo = phoneList.length > 0 || emailList.length > 0 || socialList.length > 0;

  const sanitizeForFilename = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

  const buildDownloadBaseName = () => {
    if (!personaFullName) {
      return 'LEGAJO SIN PERSONA';
    }
    const sanitized = sanitizeForFilename(personaFullName);
    if (!sanitized) {
      return 'LEGAJO SIN PERSONA';
    }
    return `LEGAJO ${sanitized.toUpperCase()}`;
  };

  const buildFallbackPdfFileName = () => `${buildDownloadBaseName()}.pdf`;
  const buildFallbackZipFileName = () => `${buildDownloadBaseName()}.zip`;

  const parseFilenameFromHeader = (header?: string | null) => {
    if (!header) return null;
    const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) {
      try {
        return decodeURIComponent(utfMatch[1]);
      } catch (error) {
        console.warn('No se pudo decodificar filename UTF-8', error);
      }
    }
    const asciiMatch = header.match(/filename="?([^";]+)"?/i);
    return asciiMatch?.[1] ?? null;
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const response = await api.get(`/cases/${caseId}/export`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const headerFilename = parseFilenameFromHeader(response.headers['content-disposition']);
      const resolvedFileName = headerFilename && headerFilename.trim().length > 0
        ? headerFilename
        : buildFallbackPdfFileName();
      link.download = resolvedFileName.endsWith('.pdf') ? resolvedFileName : `${resolvedFileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('No se pudo descargar el PDF del legajo', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleZipDownload = async () => {
    try {
      setZipDownloading(true);
      const response = await api.get(`/cases/${caseId}/export-zip`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const headerFilename = parseFilenameFromHeader(response.headers['content-disposition']);
      const resolvedFileName = headerFilename && headerFilename.trim().length > 0
        ? headerFilename
        : buildFallbackZipFileName();
      link.download = resolvedFileName.endsWith('.zip') ? resolvedFileName : `${resolvedFileName}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('No se pudo descargar el ZIP del legajo', error);
    } finally {
      setZipDownloading(false);
    }
  };

  return (
    <div className="page case-detail">
      <div className="page-header case-detail__page-header">
        <div className="case-detail__header-actions" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost" type="button" onClick={() => navigate('/cases')}>
            Volver
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn ghost" type="button" onClick={handleDownload} disabled={downloading}>
              {downloading ? 'Generando…' : 'Descargar PDF'}
            </button>
            <button className="btn ghost" type="button" onClick={handleZipDownload} disabled={zipDownloading}>
              {zipDownloading ? 'Armando ZIP…' : 'Descargar ZIP'}
            </button>
          </div>
        </div>
        <div className="case-detail__title-block">
          <p className="case-detail__subtitle">Detalle del caso</p>
          <h2>{(personaFullName || 'Caso sin persona asociada').toUpperCase()}</h2>
          <p className="case-detail__meta-line">
            {numeroCausa ? `Expediente ${numeroCausa}` : 'Sin expediente registrado'}
          </p>
        </div>
      </div>
      <section className="case-detail__resume card">
        <div className="case-detail__resume-layout">
          <aside className="case-detail__sidebar">
            {primaryPhoto ? (
              <figure className="case-detail__portrait">
                <img
                  src={resolveAssetUrl(primaryPhoto.url)}
                  alt={primaryPhoto.description ?? 'Foto principal'}
                />
                {primaryPhoto.description && <figcaption>{primaryPhoto.description}</figcaption>}
              </figure>
            ) : (
              <div className="case-detail__portrait case-detail__portrait--placeholder">
                <span>Sin foto principal</span>
              </div>
            )}

            {hasContactInfo && (
              <div className="case-detail__contact">
                <h3>Contacto</h3>
                {phoneList.length > 0 && (
                  <div className="case-detail__contact-group">
                    <span>Teléfonos</span>
                    <ul>
                      {phoneList.map((phone, index) => (
                        <li key={`phone-${index}`}>{phone}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {emailList.length > 0 && (
                  <div className="case-detail__contact-group">
                    <span>Emails</span>
                    <ul>
                      {emailList.map((email, index) => (
                        <li key={`email-${index}`}>{email}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {socialList.length > 0 && (
                  <div className="case-detail__contact-group">
                    <span>Redes</span>
                    <ul>
                      {socialList.map((social, index) => (
                        <li key={`social-${index}`}>{social}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </aside>

          <div className="case-detail__main">
            <div className="case-detail__status-row">
              <span className={`case-detail__status-chip case-detail__status-chip--${statusClass}`}>
                {statusLabel}
              </span>
              {hasReward && (
                <span className="case-detail__status-chip case-detail__status-chip--reward">
                  {rewardAmountValue ? `Recompensa ${rewardAmountValue}` : 'Recompensa sin monto confirmado'}
                </span>
              )}
            </div>

            <div className="case-detail__resume-grid">
              {personalHighlights.length > 0 && (
                <div className="case-detail__info-group">
                  <h3>Datos personales</h3>
                  <dl className="case-detail__list">
                    {personalHighlights.map((item) => (
                      <div key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {personaNotes && (
                    <div className="case-detail__notes">
                      <span>Notas</span>
                      <p>{personaNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {caseHighlights.length > 0 && (
                <div className="case-detail__info-group">
                  <h3>Resumen del caso</h3>
                  <dl className="case-detail__list">
                    {caseHighlights.map((item) => (
                      <div key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>

            <dl className="case-detail__timestamps case-detail__timestamps--inline">
              <div>
                <dt>Creado</dt>
                <dd>{createdAt}</dd>
              </div>
              <div>
                <dt>Actualizado</dt>
                <dd>{updatedAt}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

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

      <section className="case-detail__gallery-grid">
        {otherPhotos.length > 0 && (
          <div className="case-detail__section card">
            <h3>Galería de fotos</h3>
            <div className="case-detail__gallery">
              {otherPhotos.map((photo) => (
                <figure key={photo.id}>
                  <img
                    src={resolveAssetUrl(photo.url)}
                    alt={photo.description ?? 'Foto del caso'}
                  />
                  {photo.description && <figcaption>{photo.description}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        )}

        {caseRecord.documents.length > 0 && (
          <div className="case-detail__section card">
            <h3>Documentos adjuntos</h3>
            <ul className="case-detail__documents">
              {caseRecord.documents.map((doc) => (
                <li key={doc.id}>
                  <a href={resolveAssetUrl(doc.url)} target="_blank" rel="noreferrer">
                    {doc.description ?? doc.originalName}
                  </a>
                  <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};

export default CaseDetailPage;
