import type { components } from './generated/api';

type Schemas = components['schemas'];

export type Lesson = Schemas['LessonOut'];
export type MediaSources = Schemas['MediaSources'];
export type CaptionTrack = Schemas['CaptionTrackOut'];
export type TranscriptRef = Schemas['TranscriptRef'];
export type Transcript = Schemas['TranscriptOut'];
export type TranscriptSegment = Schemas['TranscriptSegment'];
export type LessonDocument = Schemas['LessonDocumentOut'];
export type Chapter = Schemas['Chapter'];
export type OfflinePackage = Schemas['OfflinePackageOut'];
export type OfflineResource = Schemas['OfflineResource'];
export type Career = Schemas['CareerOut'];
export type CareerPage = Schemas['CareerPage'];
export type CertificateVerification = Schemas['CertificateVerificationOut'];
export type ApiError = Schemas['ErrorResponse'];

export const API_VERSION_PREFIX = '/api/v1';
