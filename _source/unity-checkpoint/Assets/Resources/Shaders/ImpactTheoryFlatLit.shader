Shader "Impact Theory/Flat Lit"
{
    Properties
    {
        _Color ("Colour", Color) = (1, 1, 1, 1)
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        LOD 100

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                half lighting : TEXCOORD0;
            };

            fixed4 _Color;

            v2f vert(appdata input)
            {
                v2f output;
                output.vertex = UnityObjectToClipPos(input.vertex);

                half3 worldNormal = normalize(UnityObjectToWorldNormal(input.normal));
                half3 lightDirection = normalize(half3(0.35h, 0.80h, -0.45h));
                output.lighting = 0.58h + (0.42h * saturate(dot(worldNormal, lightDirection)));
                return output;
            }

            fixed4 frag(v2f input) : SV_Target
            {
                return fixed4(_Color.rgb * input.lighting, _Color.a);
            }
            ENDCG
        }
    }

    Fallback "Unlit/Color"
}
