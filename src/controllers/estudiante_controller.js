import Estudiante from '../models/Estudiante.js';

/**
 * Listar estudiantes con filtros opcionales
 * Solo para administradores
 * Filtros disponibles: carrera, nivel, apellido
 */
export const listarEstudiantes = async (req, res) => {
  try {
    const { carrera, nivel, apellido } = req.query;

    // Construir filtro dinámico
    const filtro = { rol: 'estudiante' }; // Solo usuarios con rol estudiante

    // Filtro por carrera (búsqueda exacta)
    if (carrera) {
      filtro.carrera = carrera;
    }

    // Filtro por nivel (búsqueda exacta)
    if (nivel) {
      const nivelNumero = parseInt(nivel);
      if (nivelNumero >= 1 && nivelNumero <= 6) {
        filtro.nivel = nivelNumero;
      } else {
        return res.status(400).json({
          success: false,
          message: 'El nivel debe ser un número entre 1 y 6'
        });
      }
    }

    // Filtro por apellido (búsqueda parcial - case insensitive)
    if (apellido) {
      // Usando regex para búsqueda parcial
      filtro.apellido = { $regex: apellido, $options: 'i' };
    }

    // Buscar estudiantes con los filtros aplicados
    const estudiantes = await Estudiante.find(filtro)
      .select('nombre apellido email carrera nivel') // Solo campos básicos
      .sort({ apellido: 1, nombre: 1 }) // Ordenar por apellido y nombre
      .lean();

    res.status(200).json({
      success: true,
      total: estudiantes.length,
      filtros: {
        carrera: carrera || 'todos',
        nivel: nivel || 'todos',
        apellido: apellido || 'todos'
      },
      data: estudiantes
    });

  } catch (error) {
    console.error('Error al listar estudiantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los estudiantes',
      error: error.message
    });
  }
};

/**
 * Obtener un estudiante por ID
 * Solo para administradores
 */
export const obtenerEstudiante = async (req, res) => {
  try {
    const { id } = req.params;

    const estudiante = await Estudiante.findById(id)
      .select('-password -token') // Excluir campos sensibles
      .lean();

    if (!estudiante) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: estudiante
    });

  } catch (error) {
    console.error('Error al obtener estudiante:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el estudiante',
      error: error.message
    });
  }
};

/**
 * Obtener estadísticas de estudiantes
 * Solo para administradores
 */
export const estadisticasEstudiantes = async (req, res) => {
  try {
    // Total de estudiantes
    const totalEstudiantes = await Estudiante.countDocuments({ rol: 'estudiante' });

    // Estudiantes por carrera
    const porCarrera = await Estudiante.aggregate([
      { $match: { rol: 'estudiante' } },
      { $group: { _id: '$carrera', total: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    // Estudiantes por nivel
    const porNivel = await Estudiante.aggregate([
      { $match: { rol: 'estudiante' } },
      { $group: { _id: '$nivel', total: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalEstudiantes,
        porCarrera,
        porNivel
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};