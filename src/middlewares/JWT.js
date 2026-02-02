import jwt from "jsonwebtoken"
import Estudiante from "../models/Estudiante.js"

/**
 * Crear token JWT
 * @param {string} id - ID del usuario
 * @param {string} rol - Rol del usuario
 * @returns {string} token - JWT
 */
const crearTokenJWT = (id, rol) => {
    return jwt.sign({ id, rol }, process.env.JWT_SECRET, { expiresIn: "1d" })
}

/**
 * Verificar token JWT para rutas protegidas
 * Funciona para todos los usuarios (estudiantes y admins)
 */
const verificarTokenJWT = async (req, res, next) => {
    const { authorization } = req.headers
    
    if (!authorization) {
        return res.status(401).json({ msg: "Acceso denegado: token no proporcionado" })
    }
    
    try {
        const token = authorization.split(" ")[1]
        const { id, rol } = jwt.verify(token, process.env.JWT_SECRET)
        
        // Buscar al estudiante en la base de datos
        const estudianteBDD = await Estudiante.findById(id).lean().select("-password")
        
        if (!estudianteBDD) {
            return res.status(401).json({ msg: "Usuario no encontrado" })
        }
        
        // Agregar información del estudiante a la request
        req.estudianteHeader = estudianteBDD
        req.estudianteBDD = estudianteBDD // Para compatibilidad con controladores
        
        next()
        
    } catch (error) {
        console.log(error)
        return res.status(401).json({ msg: `Token inválido o expirado - ${error.message}` })
    }
}

/**
 * Middleware adicional para verificar si el usuario es admin
 * Usar DESPUÉS de verificarTokenJWT
 */
const verificarAdmin = (req, res, next) => {
    if (req.estudianteBDD.rol !== 'admin') {
        return res.status(403).json({ 
            msg: "Acceso denegado: se requieren permisos de administrador" 
        })
    }
    next()
}

export { 
    crearTokenJWT,
    verificarTokenJWT,
    verificarAdmin
}
