import fetch from 'node-fetch';

// ============================================================
// CONFIGURACIÓN DEL MODELO DE IA (Hugging Face Router)
// ============================================================
const HF_API_URL = 'https://router.huggingface.co/v1/chat/completions';

// ============================================================
// POST /api/ia/generar-titulo
// Body: { descripcion: string }
// Retorna: { success, data: { titulos, ejemplo, modelo } }
// ============================================================
export const generarImagenProyecto = async (req, res) => {
  try {
    const { descripcion } = req.body;

    // Validación de entrada
    if (!descripcion || descripcion.trim().length < 15) {
      return res.status(400).json({
        success: false,
        message: 'La descripción debe tener al menos 15 caracteres'
      });
    }

    const hfToken = process.env.HF_API_TOKEN;
    if (!hfToken) {
      console.error('❌ HF_API_TOKEN no definido en .env');
      return res.status(500).json({
        success: false,
        message: 'Servicio de IA no configurado'
      });
    }

    // Construir prompt para la IA
    const prompt = `
Eres un asistente experto en desarrollo web.
Lee esta descripción de un proyecto:

"${descripcion}"

Genera un JSON que contenga:
- "titulos": un arreglo con 3 posibles títulos para este proyecto web.
- "ejemplo": un texto que explique brevemente qué hace el proyecto.

Devuelve SOLO el JSON, nada más.
`;

    // Llamada al router de Hugging Face
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.2-1B-Instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 250
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error Hugging Face:', response.status, errorText);
      return res.status(500).json({
        success: false,
        message: 'Error al comunicarse con la IA'
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    // Intentar limpiar y extraer JSON válido
    let salida;
    try {
      const inicio = text.indexOf('{');
      const fin = text.lastIndexOf('}');

      if (inicio !== -1 && fin !== -1) {
        const posibleJson = text.substring(inicio, fin + 1);
        salida = JSON.parse(posibleJson);
      } else {
        throw new Error('No se encontró JSON en la respuesta');
      }
    } catch (parseError) {
      console.error('❌ No se pudo extraer JSON válido:', parseError, '\nTexto IA:', text);
      return res.status(500).json({
        success: false,
        message: 'La IA no devolvió un JSON interpretable'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        titulos: salida.titulos || [],
        ejemplo: salida.ejemplo || '',
        modelo: 'meta-llama/Llama-3.2-1B-Instruct'
      }
    });

  } catch (error) {
    console.error('❌ Error interno IA:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};
