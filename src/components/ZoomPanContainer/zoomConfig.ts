export interface ZoomConfig {
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  initialZoom: number;
  wheelZoomSpeed: number;
  centerOnLoad?: boolean;
}

export const defaultZoomConfig: ZoomConfig = {
  minZoom: 0.1,
  maxZoom: 5,
  zoomStep: 0.1,
  initialZoom: 1,
  wheelZoomSpeed: 0.001,
  centerOnLoad: false,
};