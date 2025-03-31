// internal/api/handler/plc.go
package handler

import (
	"app_padrao/internal/domain"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// PLCHandler gerencia requisições relacionadas a PLCs
type PLCHandler struct {
	plcService domain.PLCService
}

// NewPLCHandler cria um novo handler de PLC
func NewPLCHandler(plcService domain.PLCService) *PLCHandler {
	return &PLCHandler{
		plcService: plcService,
	}
}

// validarPLC valida os campos de um PLC
func (h *PLCHandler) validarPLC(c *gin.Context, plc *domain.PLC) bool {
	// Validar nome
	if plc.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nome do PLC é obrigatório"})
		return false
	}

	// Validar endereço IP
	if plc.IPAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Endereço IP do PLC é obrigatório"})
		return false
	}

	// Validar rack e slot
	if plc.Rack < 0 || plc.Slot < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valores de Rack e Slot devem ser não-negativos"})
		return false
	}

	return true
}

// GetAllPLCs retorna a lista de todos os PLCs
func (h *PLCHandler) GetAllPLCs(c *gin.Context) {
	// Verificar se há filtro de ativos
	activeOnly := c.Query("active")
	var plcs []domain.PLC
	var err error

	if activeOnly == "true" {
		plcs, err = h.plcService.GetActivePLCs()
	} else {
		plcs, err = h.plcService.GetAll()
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Erro ao buscar PLCs: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"plcs": plcs})
}

// GetPLC retorna um PLC específico
func (h *PLCHandler) GetPLC(c *gin.Context) {
	// Extrair e validar o ID
	id, err := h.getIDFromParams(c)
	if err != nil {
		return
	}

	// Buscar o PLC
	plc, err := h.plcService.GetByID(id)
	if err != nil {
		statusCode := http.StatusInternalServerError

		if errors.Is(err, domain.ErrPLCNotFound) {
			statusCode = http.StatusNotFound
		}

		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}

	// Opcionalmente buscar as tags do PLC
	includeTags := c.Query("include_tags")
	if includeTags == "true" {
		tags, err := h.plcService.GetPLCTags(id)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"plc":        plc,
				"tags_error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"plc":  plc,
			"tags": tags,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"plc": plc})
}

// CreatePLC cria um novo PLC
func (h *PLCHandler) CreatePLC(c *gin.Context) {
	var plc domain.PLC

	// Fazer binding e validar dados
	if err := c.ShouldBindJSON(&plc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Erro ao processar dados: %v", err)})
		return
	}

	// Validar campos
	if !h.validarPLC(c, &plc) {
		return
	}

	// Criar o PLC
	id, err := h.plcService.Create(plc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Erro ao criar PLC: %v", err)})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      id,
		"message": "PLC criado com sucesso",
	})
}

// UpdatePLC atualiza um PLC existente
func (h *PLCHandler) UpdatePLC(c *gin.Context) {
	// Extrair e validar o ID
	id, err := h.getIDFromParams(c)
	if err != nil {
		return
	}

	// Buscar o PLC existente para confirmar que existe
	_, err = h.plcService.GetByID(id)
	if err != nil {
		statusCode := http.StatusInternalServerError

		if errors.Is(err, domain.ErrPLCNotFound) {
			statusCode = http.StatusNotFound
		}

		c.JSON(statusCode, gin.H{"error": fmt.Sprintf("Erro ao buscar PLC: %v", err)})
		return
	}

	// Fazer binding dos dados de atualização
	var plc domain.PLC
	if err := c.ShouldBindJSON(&plc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Erro ao processar dados: %v", err)})
		return
	}

	// Validar campos
	if !h.validarPLC(c, &plc) {
		return
	}

	// Garantir que o ID é o correto
	plc.ID = id

	// Atualizar o PLC
	if err := h.plcService.Update(plc); err != nil {
		statusCode := http.StatusInternalServerError

		if errors.Is(err, domain.ErrPLCNotFound) {
			statusCode = http.StatusNotFound
		}

		c.JSON(statusCode, gin.H{"error": fmt.Sprintf("Erro ao atualizar PLC: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PLC atualizado com sucesso"})
}

// DeletePLC exclui um PLC
func (h *PLCHandler) DeletePLC(c *gin.Context) {
	// Extrair e validar o ID
	id, err := h.getIDFromParams(c)
	if err != nil {
		return
	}

	// Excluir o PLC
	if err := h.plcService.Delete(id); err != nil {
		statusCode := http.StatusInternalServerError

		if errors.Is(err, domain.ErrPLCNotFound) {
			statusCode = http.StatusNotFound
		}

		c.JSON(statusCode, gin.H{"error": fmt.Sprintf("Erro ao excluir PLC: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PLC excluído com sucesso"})
}

// GetPLCTags retorna todas as tags de um PLC
func (h *PLCHandler) GetPLCTags(c *gin.Context) {
	// Extrair e validar o ID
	id, err := h.getIDFromParams(c)
	if err != nil {
		return
	}

	// Buscar as tags
	tags, err := h.plcService.GetPLCTags(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Erro ao buscar tags: %v", err)})
		return
	}

	// Filtrar por tag ativa se solicitado
	activeOnly := c.Query("active")
	if activeOnly == "true" {
		activeTags := make([]domain.PLCTag, 0)
		for _, tag := range tags {
			if tag.Active {
				activeTags = append(activeTags, tag)
			}
		}
		c.JSON(http.StatusOK, gin.H{"tags": activeTags})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tags": tags})
}

// GetTagByID retorna uma tag específica
func (h *PLCHandler) GetTagByID(c *gin.Context) {
	// Extrair e validar o ID
	id, err := h.getIDFromParams(c)
	if err != nil {
		return
	}

	// Buscar a tag
	tag, err := h.plcService.GetTagByID(id)
	if err != nil {
		statusCode := http.StatusInternalServerError

		if errors.Is(err, domain.ErrPLCTagNotFound) {
			statusCode = http.StatusNotFound
		}

		c.JSON(statusCode, gin.H{"error": fmt.Sprintf("Erro ao buscar tag: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tag": tag})
}

// validarTag valida os campos de uma tag
func (h *PLCHandler) validarTag(c *gin.Context, tag *domain.PLCTag) bool {
	// Validar nome
	if tag.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nome da tag é obrigatório"})
		return false
	}

	// Validar tipo de dados
	if tag.DataType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tipo de dados da tag é obrigatório"})
		return false
	}

	// Validar bit offset para tipo bool
	if tag.DataType == "bool" {
		if tag.BitOffset < 0 || tag.BitOffset > 7 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bit offset deve estar entre 0 e 7 para tipo bool"})
			return false
		}
	}

	// Validar scan rate
	if tag.ScanRate < 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Taxa de scan deve ser maior ou igual a 100ms"})
		return false
	}

	return true
}

// CreatePLCTag cria uma nova tag para um PLC
func (h *PLCHandler) CreatePLCTag(c *gin.Context) {
	// Extrair e validar o ID do PLC
	plcID, err := h.getIDFromParams(c)
	if err != nil {
		return
	}

	// Fazer binding dos dados da tag
	var tag domain.PLCTag
	if err := c.ShouldBindJSON(&tag); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Erro ao processar dados: %v", err)})
		return
	}

	// Validar campos
	if !h.validarTag(c, &tag) {
		return
	}

	// Associar tag ao PLC
	tag.PLCID = plcID

	// Criar a tag
	id, err := h.plcService.CreateTag(tag)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Erro ao criar tag: %v", err)})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      id,
		"message": "Tag criada com sucesso",
	})
}

// UpdatePLCTag atualiza uma tag existente
func (h *PLCHandler) UpdatePLCTag(c *gin.Context) {
	// Extrair e validar o ID da tag
	id, err := h.getIDFromParams(c)
	if err != nil {
		return
	}

	// Buscar a tag existente para confirmar que existe
	oldTag, err := h.plcService.GetTagByID(id)
	if err != nil {
		statusCode := http.StatusInternalServerError

		if errors.Is(err, domain.ErrPLCTagNotFound) {
			statusCode = http.StatusNotFound
		}

		c.JSON(statusCode, gin.H{"error": fmt.Sprintf("Erro ao buscar tag: %v", err)})
		return
	}

	// Fazer binding dos dados de atualização
	var tag domain.PLCTag
	if err := c.ShouldBindJSON(&tag); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Erro ao processar dados: %v", err)})
		return
	}

	// Validar campos
	if !h.validarTag(c, &tag) {
		return
	}

	// Garantir que o ID é o correto
	tag.ID = id

	// Manter o PLCID se não foi alterado
	if tag.PLCID == 0 {
		tag.PLCID = oldTag.PLCID
	}

	// Atualizar a tag
	if err := h.plcService.UpdateTag(tag); err != nil {
		statusCode := http.StatusInternalServerError

		if errors.Is(err, domain.ErrPLCTagNotFound) {
			statusCode = http.StatusNotFound
		}

		c.JSON(statusCode, gin.H{"error": fmt.Sprintf("Erro ao atualizar tag: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tag atualizada com sucesso"})
}

// DeletePLCTag exclui uma tag
func (h *PLCHandler) DeletePLCTag(c *gin.Context) {
	// Extrair e validar o ID
	id, err := h.getIDFromParams(c)
	if err != nil {
		return
	}

	// Excluir a tag
	if err := h.plcService.DeleteTag(id); err != nil {
		statusCode := http.StatusInternalServerError

		if errors.Is(err, domain.ErrPLCTagNotFound) {
			statusCode = http.StatusNotFound
		}

		c.JSON(statusCode, gin.H{"error": fmt.Sprintf("Erro ao excluir tag: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tag excluída com sucesso"})
}

// WriteTagValue escreve um valor em uma tag
func (h *PLCHandler) WriteTagValue(c *gin.Context) {
	// Fazer binding dos dados
	var input struct {
		TagName string      `json:"tag_name" binding:"required"`
		Value   interface{} `json:"value" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Erro ao processar dados: %v", err)})
		return
	}

	// Validar tag_name
	if input.TagName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nome da tag é obrigatório"})
		return
	}

	// Validar value
	if input.Value == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valor não pode ser nulo"})
		return
	}

	// Escrever o valor
	if err := h.plcService.WriteTagValue(input.TagName, input.Value); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Erro ao escrever valor: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Valor escrito com sucesso",
		"time":    time.Now().Format(time.RFC3339),
	})
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

// DiagnosticTags verifica e repara problemas com as tags
func (h *PLCHandler) DiagnosticTags(c *gin.Context) {
	results, err := h.plcService.DiagnosticTags()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Erro ao executar diagnóstico: %v", err)})
		return
	}

	c.JSON(http.StatusOK, results)
}

// ResetPLCConnection força uma reconexão com um PLC específico
func (h *PLCHandler) ResetPLCConnection(c *gin.Context) {
	// Extrair e validar o ID
	id, err := h.getIDFromParams(c)
	if err != nil {
		return
	}

	// Resetar a conexão
	err = h.plcService.ResetPLCConnection(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Erro ao resetar conexão: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Reconexão com o PLC solicitada com sucesso",
		"time":    time.Now().Format(time.RFC3339),
	})
}

// GetPLCHealth retorna o status de saúde de todos os PLCs
func (h *PLCHandler) GetPLCHealth(c *gin.Context) {
	health, err := h.plcService.CheckPLCHealth()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Erro ao verificar saúde: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"health": health,
		"time":   time.Now().Format(time.RFC3339),
	})
}

// GetDetailedStats retorna estatísticas detalhadas do sistema
func (h *PLCHandler) GetDetailedStats(c *gin.Context) {
	stats := h.plcService.GetStatistics()

	c.JSON(http.StatusOK, gin.H{
		"statistics": stats,
		"time":       time.Now().Format(time.RFC3339),
	})
}

// getIDFromParams extrai o ID dos parâmetros da URL
func (h *PLCHandler) getIDFromParams(c *gin.Context) (int, error) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID inválido"})
		return 0, err
	}

	if id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID deve ser maior que zero"})
		return 0, fmt.Errorf("ID inválido")
	}

	return id, nil
}
