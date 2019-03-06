#version 300 es
precision mediump float;

in vec3 v_normal;
in vec3 v_position;
uniform vec3 lightdir;
out vec4 fragColor;

// rot(a), hash31(p), noise3(p) come from https://www.shadertoy.com/view/lsVyRy
// fbm33 is a modified version of fbm3 from the same place
// === pseudo Perlin noise =============================================
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

// --- 3D 
#define hash31(p) fract(sin(dot(p,vec3(127.1,311.7, 74.7)))*43758.5453123)
float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p); f = f*f*(3.-2.*f); // smoothstep

    float v= mix( mix( mix(hash31(i+vec3(0,0,0)),hash31(i+vec3(1,0,0)),f.x),
                       mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x), f.y), 
                  mix( mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),
                       mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x), f.y), f.z);
    return 2.*v-1.;
}

#define noise33(p) vec3(noise3(p),noise3(p+17.7),noise3(p+31.3))
vec3 fbm33(vec3 p) {
    vec3 v = vec3(0.);
    float a = .5;
    mat2 R = rot(.37);

    for (int i = 0; i < 9; i++, p*=2.,a/=2.) 
        p.xy *= R, p.yz *= R,
            v += a * noise33(p);

    return v;
}

// mod289, mod7 and permute are taken from
// https://github.com/ashima/webgl-noise/blob/master/src/cellular3D.glsl
// worley is a simplified version of the cellular function from there
vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

// Modulo 7 without a division
vec3 mod7(vec3 x) {
  return x - floor(x * (1.0 / 7.0)) * 7.0;
}

// Modulo 7 without a division
vec4 mod7(vec4 x) {
    return x - floor(x * (1.0 / 7.0)) * 7.0;
}

// Permutation polynomial: (34x^2 + x) mod 289
vec3 permute(vec3 x) {
    return mod289((34.0 * x + 1.0) * x);
}

vec4 permute(vec4 x) {
    return mod289((34.0 * x + 1.0) * x);
}

vec2 worley(vec3 P, out vec3 firstVec, out vec3 secondVec) {
    const float K = 0.142857142857; // 1/7
    const float Ko = 0.428571428571; // 1/2-K/2
    const float K2 = 0.020408163265306; // 1/(7*7)
    const float Kz = 0.166666666667; // 1/6
    const float Kzo = 0.416666666667; // 1/2-1/6*2
    const float jitter = 1.0; // smaller jitter gives more regular pattern

    vec3 Pi = mod289(floor(P));
    vec3 Pf = fract(P) - 0.5;

    vec3 Pfx = Pf.x + vec3(1.0, 0.0, -1.0);
    vec3 Pfy = Pf.y + vec3(1.0, 0.0, -1.0);
    vec3 Pfz = Pf.z + vec3(1.0, 0.0, -1.0);

    vec3 p_for_x = permute(Pi.x + vec3(-1.0, 0.0, 1.0));

    float first = 9999999.9;
    float second = 9999999.9;

    for (int i = -1; i <= 1; i++) {
        vec3 p_for_y = permute(p_for_x + Pi.y + float(i));

        for (int j = -1; j <= 1; j++) {
            vec3 p_for_z = permute(p_for_y + Pi.z + float(j));

            vec3 ox = fract(p_for_z*K) - Ko;
            vec3 oy = mod7(floor(p_for_z*K))*K - Ko;
            vec3 oz = floor(p_for_z*K2)*Kz - Kzo; // p_for_z < 289 guaranteed

            vec3 dx = Pfx + jitter*ox;
            vec3 dy = Pfy[i + 1] + jitter*oy;
            vec3 dz = Pfz[j + 1] + jitter*oz;

            vec3 d = dx*dx + dy*dy + dz*dz;

            for (int k = 0; k < 3; k++) {
                if (d[k] < first) {
                    second = first;
                    secondVec = firstVec;
                    first = d[k];
                    firstVec = vec3(dx[k], dy[k], dz[k]);
                } else if (d[k] < second) {
                    second = d[k];
                    secondVec = vec3(dx[k], dy[k], dz[k]);
                }
            }
        }
    }

    return sqrt(vec2(first, second));
}
    
void main() {
    float diffuse_factor = max(0.2, dot(normalize(v_normal), lightdir));

    vec3 firstVec, secondVec;
    vec2 dists = worley(v_position * 10.0 + fbm33(v_position), firstVec, secondVec);
    float noise_factor = length(secondVec - firstVec) / (dists[1] + dists[0]);
    vec3 brown = vec3(0.54, 0.26, 0.1);
    fragColor = vec4(diffuse_factor * noise_factor * brown, 1);
}
