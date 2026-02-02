import Proyecto from '../models/Proyecto.js';
import Estudiante from '../models/Estudiante.js';
import { subirImagenCloudinary, eliminarImagenCloudinary } from '../helpers/uploadCloudinary.js';

/**
 * Función helper para construir filtro de proyectos para usuarios normales
 * Muestra solo proyectos publicados O proyectos propios del usuario
 */
const construirFiltroUsuario = (estudianteId, filtroAdicional = {}) => {
  return {
    $or: [
      { estado: 'publicado' },
      { autor: estudianteId }
    ],
    publico: true,
    ...filtroAdicional
  };
};

// ===== LISTAR PROYECTOS =====
export const listarProyectos = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      estado, 
      carrera,
      sort = '-createdAt'
    } = req.query;

    const estudianteId = req.estudianteBDD?._id;

    let filtro = {};
    
    // Si hay usuario logueado, aplicar filtro de usuario
    if (estudianteId) {
      filtro = construirFiltroUsuario(estudianteId);
    } else {
      // Si no hay usuario, solo mostrar publicados
      filtro = { estado: 'publicado', publico: true };
    }

    // Agregar filtros adicionales
    if (estado && estudianteId) {
      // Solo aplicar filtro de estado si el usuario está logueado
      filtro.estado = estado;
    }
    
    if (carrera) {
      filtro.carrera = decodeURIComponent(carrera);
    }

    const proyectos = await Proyecto.find(filtro)
      .populate('autor', 'nombre apellido carrera email')
      .populate('colaboradores', 'nombre apellido carrera')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Proyecto.countDocuments(filtro);

    res.status(200).json({
      success: true,
      data: proyectos,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Error al listar proyectos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener los proyectos',
      error: error.message,
    });
  }
};

// ===== OBTENER UN PROYECTO =====
export const obtenerProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD?._id;

    const proyecto = await Proyecto.findById(id)
      .populate('autor', 'nombre apellido carrera email')
      .populate('colaboradores', 'nombre apellido carrera')
      .populate('comentarios.estudiante', 'nombre apellido');

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    // Verificar si el usuario puede ver este proyecto
    const esAutor = estudianteId && proyecto.autor._id.toString() === estudianteId.toString();
    const esPublicado = proyecto.estado === 'publicado';

    if (!esPublicado && !esAutor) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este proyecto',
      });
    }

    // Incrementar vistas solo si es publicado
    if (esPublicado) {
      await proyecto.incrementarVistas();
    }

    res.status(200).json({
      success: true,
      data: proyecto,
    });
  } catch (error) {
    console.error('Error al obtener proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el proyecto',
      error: error.message,
    });
  }
};

// ===== CREAR PROYECTO =====
export const crearProyecto = async (req, res) => {
  try {
    const estudianteId = req.estudianteBDD._id;

    const nuevoProyecto = new Proyecto({
      ...req.body,
      autor: estudianteId,
      estado: 'en_progreso', // Estado por defecto
    });

    // Manejar subida de imagen si existe
    if (req.files?.imagen) {
      const { secure_url, public_id } = await subirImagenCloudinary(
        req.files.imagen.tempFilePath,
        'Proyectos'
      );
      
      nuevoProyecto.imagenes = [secure_url];
      nuevoProyecto.imagenesID = [public_id];
    }

    await nuevoProyecto.save();
    await nuevoProyecto.populate('autor', 'nombre apellido carrera email');

    res.status(201).json({
      success: true,
      message: 'Proyecto creado exitosamente. Está en estado "en_progreso" y será visible para ti. Un administrador debe publicarlo para que sea visible para todos.',
      data: nuevoProyecto,
    });
  } catch (error) {
    console.error('Error al crear proyecto:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: Object.values(error.errors).map(err => err.message),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear el proyecto',
      error: error.message,
    });
  }
};

// ===== ACTUALIZAR PROYECTO =====
export const actualizarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;

    const proyecto = await Proyecto.findById(id);

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    // Verificar que sea el autor
    if (proyecto.autor.toString() !== estudianteId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para editar este proyecto',
      });
    }

    // Manejar actualización de imagen
    if (req.files?.imagen) {
      // Eliminar imagen anterior de Cloudinary si existe
      if (proyecto.imagenesID && proyecto.imagenesID.length > 0) {
        for (const publicId of proyecto.imagenesID) {
          await eliminarImagenCloudinary(publicId);
        }
      }

      // Subir nueva imagen
      const { secure_url, public_id } = await subirImagenCloudinary(
        req.files.imagen.tempFilePath,
        'Proyectos'
      );
      
      req.body.imagenes = [secure_url];
      req.body.imagenesID = [public_id];
    }

    const proyectoActualizado = await Proyecto.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate('autor', 'nombre apellido carrera email')
     .populate('colaboradores', 'nombre apellido carrera');

    res.status(200).json({
      success: true,
      message: 'Proyecto actualizado exitosamente',
      data: proyectoActualizado,
    });
  } catch (error) {
    console.error('Error al actualizar proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el proyecto',
      error: error.message,
    });
  }
};

// ===== ELIMINAR PROYECTO =====
export const eliminarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;

    const proyecto = await Proyecto.findById(id);

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    // Solo el autor puede eliminar su proyecto (admin usa sus propios endpoints)
    if (proyecto.autor.toString() !== estudianteId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este proyecto',
      });
    }

    // Eliminar imágenes de Cloudinary si existen
    if (proyecto.imagenesID && proyecto.imagenesID.length > 0) {
      for (const publicId of proyecto.imagenesID) {
        try {
          await eliminarImagenCloudinary(publicId);
        } catch (error) {
          console.error('Error al eliminar imagen de Cloudinary:', error);
        }
      }
    }

    await Proyecto.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Proyecto eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el proyecto',
      error: error.message,
    });
  }
};

// ===== FILTROS =====

export const listarProyectosPorCategoria = async (req, res) => {
  try {
    const { tipo } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const estudianteId = req.estudianteBDD?._id;

    if (!['academico', 'extracurricular'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de categoría inválida',
      });
    }

    const filtro = estudianteId 
      ? construirFiltroUsuario(estudianteId, { categoria: tipo })
      : { categoria: tipo, estado: 'publicado', publico: true };

    const proyectos = await Proyecto.find(filtro)
      .populate('autor', 'nombre apellido carrera')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Proyecto.countDocuments(filtro);

    res.status(200).json({
      success: true,
      data: proyectos,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos',
      error: error.message,
    });
  }
};

export const listarProyectosPorCarrera = async (req, res) => {
  try {
    const { carrera } = req.params;
    const estudianteId = req.estudianteBDD?._id;
    
    const carreraDecodificada = decodeURIComponent(carrera);

    const filtro = estudianteId
      ? construirFiltroUsuario(estudianteId, { carrera: carreraDecodificada })
      : { carrera: carreraDecodificada, estado: 'publicado', publico: true };

    const proyectos = await Proyecto.find(filtro)
      .populate('autor', 'nombre apellido carrera')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: proyectos,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos',
      error: error.message,
    });
  }
};

export const listarProyectosPorEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD?._id;

    // Si es el mismo estudiante, mostrar todos sus proyectos
    // Si no, solo mostrar los publicados
    const filtro = estudianteId && estudianteId.toString() === id
      ? { autor: id, publico: true }
      : { autor: id, estado: 'publicado', publico: true };

    const proyectos = await Proyecto.find(filtro)
      .populate('autor', 'nombre apellido carrera')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: proyectos,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos',
      error: error.message,
    });
  }
};

export const buscarProyectos = async (req, res) => {
  try {
    const { q } = req.query;
    const estudianteId = req.estudianteBDD?._id;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un término de búsqueda',
      });
    }

    const filtroBase = estudianteId
      ? construirFiltroUsuario(estudianteId)
      : { estado: 'publicado', publico: true };

    const proyectos = await Proyecto.find({
      $text: { $search: q },
      ...filtroBase
    })
      .populate('autor', 'nombre apellido carrera')
      .limit(20);

    res.status(200).json({
      success: true,
      data: proyectos,
      total: proyectos.length,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar proyectos',
      error: error.message,
    });
  }
};

export const proyectosDestacados = async (req, res) => {
  try {
    const estudianteId = req.estudianteBDD?._id;

    const filtro = estudianteId
      ? construirFiltroUsuario(estudianteId)
      : { estado: 'publicado', publico: true };

    const proyectos = await Proyecto.find(filtro)
      .populate('autor', 'nombre apellido carrera')
      .sort('-vistas')
      .limit(6);

    res.status(200).json({
      success: true,
      data: proyectos,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos destacados',
      error: error.message,
    });
  }
};

// ===== INTERACCIONES =====

export const agregarLike = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;

    const proyecto = await Proyecto.findById(id);
    
    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    // Verificar que el usuario pueda ver este proyecto
    const esAutor = proyecto.autor.toString() === estudianteId.toString();
    const esPublicado = proyecto.estado === 'publicado';

    if (!esPublicado && !esAutor) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para interactuar con este proyecto',
      });
    }

    await proyecto.agregarLike(estudianteId);

    res.status(200).json({
      success: true,
      message: 'Like agregado',
      likes: proyecto.likes.length,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar like',
      error: error.message,
    });
  }
};

export const quitarLike = async (req, res) => {
  try {
    const { id } = req.params;
    const estudianteId = req.estudianteBDD._id;

    const proyecto = await Proyecto.findById(id);
    
    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    // Verificar que el usuario pueda ver este proyecto
    const esAutor = proyecto.autor.toString() === estudianteId.toString();
    const esPublicado = proyecto.estado === 'publicado';

    if (!esPublicado && !esAutor) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para interactuar con este proyecto',
      });
    }

    await proyecto.quitarLike(estudianteId);

    res.status(200).json({
      success: true,
      message: 'Like quitado',
      likes: proyecto.likes.length,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al quitar like',
      error: error.message,
    });
  }
};

export const agregarComentario = async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;
    const estudianteId = req.estudianteBDD._id;

    if (!texto || texto.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El comentario no puede estar vacío',
      });
    }

    const proyecto = await Proyecto.findById(id);
    
    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    // Verificar que el usuario pueda ver este proyecto
    const esAutor = proyecto.autor.toString() === estudianteId.toString();
    const esPublicado = proyecto.estado === 'publicado';

    if (!esPublicado && !esAutor) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para interactuar con este proyecto',
      });
    }

    proyecto.comentarios.push({
      estudiante: estudianteId,
      texto: texto.trim(),
      fecha: new Date(),
    });

    await proyecto.save();
    await proyecto.populate('comentarios.estudiante', 'nombre apellido');

    res.status(201).json({
      success: true,
      message: 'Comentario agregado',
      data: proyecto.comentarios,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar comentario',
      error: error.message,
    });
  }
};

export const eliminarComentario = async (req, res) => {
  try {
    const { id, comentarioId } = req.params;
    const estudianteId = req.estudianteBDD._id;
    const esAdmin = req.estudianteBDD.rol === 'admin';

    const proyecto = await Proyecto.findById(id);
    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado',
      });
    }

    const comentario = proyecto.comentarios.id(comentarioId);
    if (!comentario) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado',
      });
    }

    if (comentario.estudiante.toString() !== estudianteId.toString() && !esAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este comentario',
      });
    }

    comentario.deleteOne();
    await proyecto.save();

    res.status(200).json({
      success: true,
      message: 'Comentario eliminado',
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar comentario',
      error: error.message,
    });
  }
};
