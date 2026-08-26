import React, { useEffect, useRef } from "react";

export interface LiquidOrbProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width in pixels or CSS units (e.g., 18, 24, "1.5rem") */
  width?: number | string;
  /** Height in pixels or CSS units (e.g., 18, 24, "1.5rem") */
  height?: number | string;
  /** Uniform size for both width and height (default: 18) */
  size?: number | string;
  /** Animation speed multiplier (default: 1) */
  speed?: number;
  /** Accessibility label */
  ariaLabel?: string;
  /** Optional custom fallback if WebGL fails */
  fallback?: React.ReactNode;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;

// High contrast Apple Intelligence palette
const vec4 u_colorA = vec4(0.20, 0.60, 1.00, 1.0);  // Bright Electric Cyan/Blue
const vec4 u_colorB = vec4(0.18, 0.98, 0.82, 1.0);  // Aqua Teal
const vec4 u_colorC = vec4(0.98, 0.45, 1.00, 1.0);  // Bright Magenta
const vec4 u_colorD = vec4(1.00, 0.80, 0.32, 1.0);  // Radiant Gold
const vec4 u_highlightColor = vec4(1.0, 1.0, 1.0, 1.0);

// Glass shell lighting
const vec4 u_shellInner = vec4(0.90, 0.95, 1.0, 1.0);
const vec4 u_shellMid = vec4(0.45, 0.90, 1.0, 1.0);   // Cyan specular
const vec4 u_shellEdge = vec4(0.90, 0.55, 1.0, 1.0);  // Magenta specular
const vec4 u_sheenColor = vec4(0.98, 0.99, 1.0, 1.0);
const vec4 u_specColor = vec4(0.94, 0.97, 1.0, 1.0);
const vec4 u_canvasColor = vec4(0.06, 0.08, 0.16, 0.98); // Deep rich navy glass
const vec4 u_glowColor = vec4(0.40, 0.65, 1.0, 1.0);   // Luminous ambient glow

// Parameters
const float u_radius = 0.82;
const float u_zoom = 0.36;
const float u_warp = 3.2;
const float u_ridgeAmt = 0.5;
const float u_exposure = 2.2;
const float u_glassOpacity = 0.55;

vec3 glsOver(vec3 dst, vec3 src, float a) {
  float k = clamp(a, 0.0, 1.0);
  return src * k + dst * (1.0 - k);
}

float glsRefractionProfile(float t) {
  float depth = clamp(t, 0.0, 1.0);
  float circular = sqrt(max(1.0 - (1.0 - depth) * (1.0 - depth), 0.0));
  return 1.0 - circular;
}

float glsHighlightLobe(vec2 normal, vec2 direction, float cut, float power) {
  float angular = clamp((dot(normal, direction) - cut) / max(1.0 - cut, 0.001), 0.0, 1.0);
  return pow(angular, power);
}

vec3 glsFinishPresetFluid(vec3 colorIn, vec2 p) {
  vec3 color = colorIn;
  color = mix(color, u_highlightColor.rgb, 0.18 * smoothstep(0.15, 1.15, dot(p, vec2(-0.32, 0.78))));
  color = color * (1.0 - 0.25 * smoothstep(-0.1, 1.2, dot(p, vec2(0.45, -0.62))));
  return clamp(color, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));
}

vec2 glsSiriBand(vec2 q, float drift, float phaseOffset, float amplitude, float mainY, float envelope, float softness) {
  float y = amplitude * envelope * sin(q.x * 1.0 + drift + phaseOffset);
  float distanceToLine = abs(q.y - y);
  float line = 0.022 / (sqrt(distanceToLine * distanceToLine + softness * softness) + 0.024);
  float bandDistance = max(0.0, max(q.y - max(mainY, y), min(mainY, y) - q.y));
  float band = 0.022 / (bandDistance + 0.065);
  return vec2(line, band);
}

vec3 glsSiriFluid(vec2 p, float t) {
  float scale = 0.74 + u_zoom * 0.34;
  vec2 q = p / scale;
  float xNorm = q.x;
  float envelopeBase = cos(1.57079633 * min(abs(0.9 * xNorm), 1.0));
  float envelope = envelopeBase * envelopeBase;
  float low = 0.5 + 0.5 * cos(t * 0.37);
  float mid = 0.5 + 0.5 * sin(t * 0.51 + 1.2);
  float high = 0.5 + 0.5 * cos(t * 0.73 + 2.1);
  float drift = t * 2.4;
  float mainAmplitude = 0.25 + u_ridgeAmt * 0.075 + low * 0.018;
  float bandAmplitude = mainAmplitude + mid * 0.025 + high * 0.018;
  float mainY = mainAmplitude * envelope * sin(q.x * 1.1 + drift);
  float separation = 1.85 + u_warp * 0.2 + mid * 0.28;
  float softness = 0.035 + (1.0 - u_ridgeAmt) * 0.018 + mid * 0.006;

  vec2 band0 = glsSiriBand(q, drift, -separation, bandAmplitude, mainY, envelope, softness);
  vec2 band1 = glsSiriBand(q, drift, -separation * 0.34, bandAmplitude, mainY, envelope, softness);
  vec2 band2 = glsSiriBand(q, drift, separation * 0.34, bandAmplitude, mainY, envelope, softness);
  vec2 band3 = glsSiriBand(q, drift, separation, bandAmplitude, mainY, envelope, softness);
  float w0 = band0.x + band0.y;
  float w1 = band1.x + band1.y;
  float w2 = band2.x + band2.y;
  float w3 = band3.x + band3.y;
  float total = w0 + w1 + w2 + w3;
  float dominant0 = w0 * w0;
  float dominant1 = w1 * w1;
  float dominant2 = w2 * w2;
  float dominant3 = w3 * w3;
  float dominantTotal = dominant0 + dominant1 + dominant2 + dominant3;
  vec3 spectral = (u_colorA.rgb * dominant0 + u_colorC.rgb * dominant1
                + u_colorB.rgb * dominant2 + u_colorD.rgb * dominant3)
                / max(dominantTotal, 0.0001);
  float energy = (1.0 - exp(-total * 0.65)) * envelope;
  float mainDistance = abs(q.y - mainY);
  float whiteCore = exp(-mainDistance * mainDistance / 0.0030) * envelope;
  
  // Ambient interior nebula glow (visible on dark backgrounds)
  vec3 atmosphere = mix(vec3(0.05, 0.08, 0.20), vec3(0.10, 0.05, 0.22), clamp(q.y * 0.5 + 0.5, 0.0, 1.0));
  
  vec3 color = atmosphere + spectral * energy * 1.65;
  color = color + u_highlightColor.rgb * whiteCore * (0.38 + 0.15 * low);
  color = color / (vec3(1.0, 1.0, 1.0) + color * 0.15);
  return glsFinishPresetFluid(color, p);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float minRes = max(min(u_resolution.x, u_resolution.y), 1.0);
  vec2 uv = (2.0 * fc - u_resolution) / minRes;

  float rad = max(u_radius, 0.05);
  float t = u_time * (u_speed * 0.82);

  float pixelUnit = 2.0 / (minRes * rad);
  float aa = max(pixelUnit * 1.2, 0.02);

  float dist = length(uv);
  float pd = dist / rad;

  // Soft ambient outer halo for dark mode visibility
  float halo = exp(-max(pd - 0.92, 0.0) * 10.0) * 0.40 * smoothstep(1.30, 0.95, pd);

  if (pd > 1.30) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  vec2 normal = (pd > 0.0001) ? (uv / dist) : vec2(0.0, 0.0);

  // Smooth ball antialiased alpha
  float ballA = smoothstep(1.0 + aa, 1.0 - aa, pd);

  // Normal Z for 3D sphere fresnel
  float normalZ = sqrt(max(1.0 - clamp(pd * pd, 0.0, 1.0), 0.0));
  float fresnel = pow(1.0 - normalZ, 2.0);

  // Smooth edge depth
  float edgeDepth = clamp(1.0 - pd, 0.0, 1.0);

  // Continuous refraction
  float refractionWidth = max(0.20, pixelUnit * 4.0);
  float refractionT = clamp(edgeDepth / refractionWidth, 0.0, 1.0);
  float refractionProfile = pow(glsRefractionProfile(refractionT), 0.68);
  
  float edgeTaper = smoothstep(0.0, aa * 2.0, edgeDepth);
  float refractionAmount = 0.60 * u_glassOpacity * refractionProfile * edgeTaper;
  vec2 refractedP = (uv / rad) - normal * refractionAmount;

  // Optical dispersion (3-channel split)
  float channelSplit = 0.12 * u_glassOpacity * refractionProfile * edgeTaper;
  vec3 redSample = glsSiriFluid(refractedP - normal * channelSplit, t);
  vec3 greenSample = glsSiriFluid(refractedP, t);
  vec3 blueSample = glsSiriFluid(refractedP + normal * channelSplit, t);
  vec3 fcol = vec3(redSample.r, greenSample.g, blueSample.b);

  float lum = dot(fcol, vec3(0.213, 0.715, 0.072));
  vec3 clearSat = clamp(vec3(lum, lum, lum) + (fcol - vec3(lum, lum, lum)) * 1.25, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));
  vec3 col = glsOver(u_canvasColor.rgb, clearSat, 0.98);

  // Rich glass rim highlights & fresnel glow
  float surfaceWidth = max(0.075, pixelUnit * 2.5);
  float surfaceBand = (1.0 - smoothstep(0.0, surfaceWidth, edgeDepth)) * edgeTaper;
  float opticalRim = pow(surfaceBand, 1.35);

  // Subtle glass body edge illumination
  col = glsOver(col, u_shellInner.rgb, opticalRim * 0.55 + fresnel * 0.40);

  vec2 coolDirection = normalize(vec2(0.84, 0.54));
  vec2 warmDirection = normalize(vec2(-0.62, -0.78));
  float coolSplit = glsHighlightLobe(normal, coolDirection, -0.32, 1.8);
  float warmSplit = glsHighlightLobe(normal, warmDirection, -0.28, 2.0);
  col = glsOver(col, u_shellMid.rgb, (opticalRim + fresnel * 0.45) * coolSplit * 1.15);
  col = glsOver(col, u_shellEdge.rgb, (opticalRim + fresnel * 0.45) * warmSplit * 1.15);

  vec2 keyDirection = normalize(vec2(-0.68, 0.73));
  vec2 fillDirection = normalize(vec2(0.74, -0.67));
  float key = opticalRim * glsHighlightLobe(normal, keyDirection, 0.2, 2.8) * 1.4;
  float fill = opticalRim * glsHighlightLobe(normal, fillDirection, 0.4, 3.6) * 1.0;
  col = glsOver(col, u_sheenColor.rgb, key);
  col = glsOver(col, u_specColor.rgb, fill);

  col = clamp(col * u_exposure, vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));

  // Combine ball with outer ambient glow
  vec3 finalColor = col * ballA + u_glowColor.rgb * halo * (1.0 - ballA * 0.5);
  float finalAlpha = clamp(ballA + halo, 0.0, 1.0);

  gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

export const LiquidOrb: React.FC<LiquidOrbProps> = ({
  width,
  height,
  size = 18,
  speed = 1.0,
  className = "",
  style,
  ariaLabel = "Liquid Orb",
  fallback,
  ...rest
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const resolvedWidth = width ?? size;
  const resolvedHeight = height ?? size;

  const styleDimension = (val: number | string) =>
    typeof val === "number" ? `${val}px` : val;

  const computedStyle: React.CSSProperties = {
    width: styleDimension(resolvedWidth),
    height: styleDimension(resolvedHeight),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    flexShrink: 0,
    ...style,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true }) ||
      canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true }) ||
      canvas.getContext("experimental-webgl");

    if (!gl) return;

    let stopped = false;
    let animationFrame = 0;

    function createShader(type: number, source: string) {
      const shader = (gl as WebGLRenderingContext).createShader(type);
      if (!shader) return null;
      (gl as WebGLRenderingContext).shaderSource(shader, source);
      (gl as WebGLRenderingContext).compileShader(shader);
      if (!(gl as WebGLRenderingContext).getShaderParameter(shader, (gl as WebGLRenderingContext).COMPILE_STATUS)) {
        console.error((gl as WebGLRenderingContext).getShaderInfoLog(shader));
        (gl as WebGLRenderingContext).deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = createShader((gl as WebGLRenderingContext).VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader((gl as WebGLRenderingContext).FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = (gl as WebGLRenderingContext).createProgram();
    if (!program) return;

    (gl as WebGLRenderingContext).attachShader(program, vs);
    (gl as WebGLRenderingContext).attachShader(program, fs);
    (gl as WebGLRenderingContext).linkProgram(program);

    if (!(gl as WebGLRenderingContext).getProgramParameter(program, (gl as WebGLRenderingContext).LINK_STATUS)) {
      console.error((gl as WebGLRenderingContext).getProgramInfoLog(program));
      return;
    }

    const positionLoc = (gl as WebGLRenderingContext).getAttribLocation(program, "a_position");
    const resolutionLoc = (gl as WebGLRenderingContext).getUniformLocation(program, "u_resolution");
    const timeLoc = (gl as WebGLRenderingContext).getUniformLocation(program, "u_time");
    const speedLoc = (gl as WebGLRenderingContext).getUniformLocation(program, "u_speed");

    const positionBuffer = (gl as WebGLRenderingContext).createBuffer();
    (gl as WebGLRenderingContext).bindBuffer((gl as WebGLRenderingContext).ARRAY_BUFFER, positionBuffer);
    (gl as WebGLRenderingContext).bufferData(
      (gl as WebGLRenderingContext).ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      (gl as WebGLRenderingContext).STATIC_DRAW
    );

    const startedAt = performance.now();

    const render = (now: number) => {
      if (stopped || !canvasRef.current) return;

      const currentCanvas = canvasRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const displayWidth = Math.max(1, Math.floor((currentCanvas.clientWidth || 32) * dpr));
      const displayHeight = Math.max(1, Math.floor((currentCanvas.clientHeight || 32) * dpr));

      if (currentCanvas.width !== displayWidth || currentCanvas.height !== displayHeight) {
        currentCanvas.width = displayWidth;
        currentCanvas.height = displayHeight;
      }

      (gl as WebGLRenderingContext).viewport(0, 0, displayWidth, displayHeight);
      (gl as WebGLRenderingContext).clearColor(0, 0, 0, 0);
      (gl as WebGLRenderingContext).clear((gl as WebGLRenderingContext).COLOR_BUFFER_BIT);

      (gl as WebGLRenderingContext).useProgram(program);
      (gl as WebGLRenderingContext).enableVertexAttribArray(positionLoc);
      (gl as WebGLRenderingContext).bindBuffer((gl as WebGLRenderingContext).ARRAY_BUFFER, positionBuffer);
      (gl as WebGLRenderingContext).vertexAttribPointer(positionLoc, 2, (gl as WebGLRenderingContext).FLOAT, false, 0, 0);

      (gl as WebGLRenderingContext).uniform2f(resolutionLoc, displayWidth, displayHeight);
      (gl as WebGLRenderingContext).uniform1f(timeLoc, (now - startedAt) / 1000);
      (gl as WebGLRenderingContext).uniform1f(speedLoc, speed);

      (gl as WebGLRenderingContext).drawArrays((gl as WebGLRenderingContext).TRIANGLES, 0, 6);

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);

    return () => {
      stopped = true;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      try {
        (gl as WebGLRenderingContext).deleteProgram(program);
        (gl as WebGLRenderingContext).deleteShader(vs);
        (gl as WebGLRenderingContext).deleteShader(fs);
        (gl as WebGLRenderingContext).deleteBuffer(positionBuffer);
      } catch {}
    };
  }, [speed]);

  return (
    <div className={`select-none pointer-events-none ${className}`} style={computedStyle} {...rest}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        aria-label={ariaLabel}
      />
    </div>
  );
};
