package handler

import (
	"app_padrao/internal/domain"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type PLCHandler struct {
	plcService domain.PLCService
}

func NewPLCHandler(plcService domain.PLCService) *PLCHandler {
	return &PLCHandler{
		plcService: plcService,
	}
}

// GetAllPLCs retorna a lista de todos os PLCs
func (h *PLCHandler) GetAllPLCs(c *gin.Context) {
	plcs, err := h.plcService.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"plcs": plcs})
}

// GetPLC retorna um PLC específico
func (h *PLCHandler) GetPLC(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	plc, err := h.plcService.GetByID(id)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err == domain.ErrPLCNotFound {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"plc": plc})
}

// CreatePLC cria um novo PLC
func (h *PLCHandler) CreatePLC(c *gin.Context) {
	var plc domain.PLC
	if err := c.ShouldBindJSON(&plc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id, err := h.plcService.Create(plc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      id,
		"message": "PLC criado com sucesso",
	})
}

// UpdatePLC atualiza um PLC existente
func (h *PLCHandler) UpdatePLC(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	var plc domain.PLC
	if err := c.ShouldBindJSON(&plc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	plc.ID = id

	if err := h.plcService.Update(plc); err != nil {
		statusCode := http.StatusInternalServerError
		if err == domain.ErrPLCNotFound {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PLC atualizado com sucesso"})
}

// DeletePLC exclui um PLC
func (h *PLCHandler) DeletePLC(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	if err := h.plcService.Delete(id); err != nil {
		statusCode := http.StatusInternalServerError
		if err == domain.ErrPLCNotFound {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PLC excluído com sucesso"})
}

// GetPLCTags retorna todas as tags de um PLC
func (h *PLCHandler) GetPLCTags(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	tags, err := h.plcService.GetPLCTags(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tags": tags})
}

// GetTagByID retorna uma tag específica
func (h *PLCHandler) GetTagByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	tag, err := h.plcService.GetTagByID(id)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err == domain.ErrPLCTagNotFound {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tag": tag})
}

// CreatePLCTag cria uma nova tag para um PLC
func (h *PLCHandler) CreatePLCTag(c *gin.Context) {
	plcID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID do PLC inválido"})
		return
	}

	var tag domain.PLCTag
	if err := c.ShouldBindJSON(&tag); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tag.PLCID = plcID

	// Validar bit offset para tipo bool
	if tag.DataType == "bool" {
		if tag.BitOffset < 0 || tag.BitOffset > 7 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bit offset deve estar entre 0 e 7 para tipo bool"})
			return
		}
	} else {
		// Para outros tipos de dados, o bit offset deve ser 0
		tag.BitOffset = 0
	}

	id, err := h.plcService.CreateTag(tag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      id,
		"message": "Tag criada com sucesso",
	})
}

// UpdatePLCTag atualiza uma tag existente
func (h *PLCHandler) UpdatePLCTag(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	var tag domain.PLCTag
	if err := c.ShouldBindJSON(&tag); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tag.ID = id

	// Validar bit offset para tipo bool
	if tag.DataType == "bool" {
		if tag.BitOffset < 0 || tag.BitOffset > 7 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bit offset deve estar entre 0 e 7 para tipo bool"})
			return
		}
	} else {
		// Para outros tipos de dados, o bit offset deve ser 0
		tag.BitOffset = 0
	}

	if err := h.plcService.UpdateTag(tag); err != nil {
		statusCode := http.StatusInternalServerError
		if err == domain.ErrPLCTagNotFound {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tag atualizada com sucesso"})
}

// DeletePLCTag exclui uma tag
func (h *PLCHandler) DeletePLCTag(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return
	}

	if err := h.plcService.DeleteTag(id); err != nil {
		statusCode := http.StatusInternalServerError
		if err == domain.ErrPLCTagNotFound {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tag excluída com sucesso"})
}

// WriteTagValue escreve um valor em uma tag
func (h *PLCHandler) WriteTagValue(c *gin.Context) {
	var input struct {
		TagName string      `json:"tag_name" binding:"required"`
		Value   interface{} `json:"value" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.plcService.WriteTagValue(input.TagName, input.Value); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetPLCStatus retorna o status e estatísticas de monitoramento de PLCs
func (h *PLCHandler) GetPLCStatus(c *gin.Context) {
	// Usar o método GetPLCStats do PLCService para obter estatísticas
	stats := h.plcService.GetPLCStats()

	c.JSON(http.StatusOK, gin.H{
		"stats": stats,
		"time":  time.Now().Format(time.RFC3339),
	})
}
