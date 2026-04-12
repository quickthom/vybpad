import type { SongData } from "./song.js";

export interface RegisterRequest {
  email: string; // valid email format, max 255 chars
  password: string; // min 8 chars, max 128 chars
  displayName: string; // 1–50 chars, trimmed
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserResponse;
  accessToken: string; // JWT, 15 min expiry
}

export interface UserResponse {
  id: string; // UUID
  email: string;
  displayName: string;
  createdAt: string; // ISO 8601
}

export interface RefreshResponse {
  accessToken: string;
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
}

export interface ProjectSummary {
  id: string; // UUID
  name: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateProjectRequest {
  name: string; // 1–100 chars, trimmed
  songData?: SongData; // if omitted, server creates default empty song
}

export interface ProjectResponse {
  id: string; // UUID
  name: string;
  songData: SongData;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface UpdateProjectRequest {
  name?: string; // 1–100 chars if provided
  songData?: SongData; // full replacement if provided
}
