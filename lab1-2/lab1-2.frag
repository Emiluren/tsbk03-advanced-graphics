#version 150
// bump mapping should be calculated
// 1) in view coordinates
// 2) in texture coordinates

in vec2 outTexCoord;
in vec3 out_Normal;
in vec3 Ps;
in vec3 Pt;
in vec3 pixPos;  // Needed for specular reflections
uniform sampler2D texUnit;
out vec4 out_Color;

const float db = 0.002;

void main(void)
{
    vec3 light = vec3(0.0, 0.7, 0.7); // Light source in view coordinates

    // Calculate gradients here
    float offset = 1.0 / 256.0; // texture size, same in both directions

    vec4 vbs = dFdx(texture(texUnit, outTexCoord));
    vec4 vbt = dFdy(texture(texUnit, outTexCoord)); 
    float bs = (vbs.r + vbs.g + vbs.b) / 3;
    float bt = (vbt.r + vbt.g + vbt.b) / 3;

    vec3 normal = normalize(out_Normal) + Ps*bs + Pt*bt;

    // Simplified lighting calculation.
    // A full solution would include material, ambient, specular, light sources, multiply by texture.
    out_Color = vec4( dot(normal, light)) * vec4(0.5, 0.5, 0.5, 1.0);
}
