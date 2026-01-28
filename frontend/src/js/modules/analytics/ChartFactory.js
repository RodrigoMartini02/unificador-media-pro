/**
 * ChartFactory - Fábrica de Gráficos com ApexCharts
 * Cria gráficos otimizados para análise de dados de questionários
 */

// Paleta de cores para os gráficos
const CHART_COLORS = {
    satisfaction: {
        veryUnsatisfied: '#ef4444',   // Vermelho
        unsatisfied: '#f97316',       // Laranja
        neutral: '#6b7280',           // Cinza
        satisfied: '#22c55e',         // Verde
        verySatisfied: '#059669'      // Verde escuro
    },
    primary: ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4'],
    gradient: {
        start: '#3b82f6',
        end: '#1d4ed8'
    }
};

// Opções base compartilhadas
const BASE_OPTIONS = {
    chart: {
        fontFamily: 'Inter, system-ui, sans-serif',
        toolbar: {
            show: true,
            tools: {
                download: true,
                selection: false,
                zoom: false,
                zoomin: false,
                zoomout: false,
                pan: false,
                reset: false
            }
        },
        animations: {
            enabled: true,
            speed: 500
        }
    },
    theme: {
        mode: 'light'
    }
};

class ChartFactory {
    /**
     * Gráfico de Distribuição de Satisfação (Donut)
     * Mostra a distribuição das respostas por nível de satisfação
     */
    static createSatisfactionDonut(container, data) {
        const categories = ['Muito Insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito Satisfeito'];
        const colors = [
            CHART_COLORS.satisfaction.veryUnsatisfied,
            CHART_COLORS.satisfaction.unsatisfied,
            CHART_COLORS.satisfaction.neutral,
            CHART_COLORS.satisfaction.satisfied,
            CHART_COLORS.satisfaction.verySatisfied
        ];

        // Mapear dados para as categorias
        const values = categories.map(cat => {
            const item = data.find(d => d.category === cat);
            return item ? parseInt(item.count) : 0;
        });

        const options = {
            ...BASE_OPTIONS,
            chart: {
                ...BASE_OPTIONS.chart,
                type: 'donut',
                height: 350
            },
            series: values,
            labels: categories,
            colors: colors,
            legend: {
                position: 'bottom',
                horizontalAlign: 'center'
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: '65%',
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: 'Total',
                                formatter: function(w) {
                                    return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                }
                            }
                        }
                    }
                }
            },
            dataLabels: {
                enabled: true,
                formatter: function(val, opts) {
                    return Math.round(val) + '%';
                }
            },
            tooltip: {
                y: {
                    formatter: function(val) {
                        return val + ' respostas';
                    }
                }
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        return chart;
    }

    /**
     * Gráfico de Tendência de Respostas (Area)
     * Mostra a evolução das respostas ao longo do tempo
     */
    static createTrendChart(container, data) {
        const dates = data.map(d => d.date);
        const counts = data.map(d => parseInt(d.count));
        const satisfaction = data.map(d => parseFloat(d.avg_satisfaction) || 0);

        const options = {
            ...BASE_OPTIONS,
            chart: {
                ...BASE_OPTIONS.chart,
                type: 'area',
                height: 350,
                stacked: false,
                zoom: { enabled: true }
            },
            series: [
                {
                    name: 'Respostas',
                    type: 'column',
                    data: counts
                },
                {
                    name: 'Média Satisfação',
                    type: 'line',
                    data: satisfaction
                }
            ],
            colors: [CHART_COLORS.primary[0], CHART_COLORS.satisfaction.satisfied],
            xaxis: {
                categories: dates,
                type: 'category',
                labels: {
                    rotate: -45,
                    rotateAlways: dates.length > 10
                }
            },
            yaxis: [
                {
                    title: { text: 'Quantidade de Respostas' },
                    min: 0
                },
                {
                    opposite: true,
                    title: { text: 'Média Satisfação' },
                    min: 0,
                    max: 10
                }
            ],
            stroke: {
                width: [0, 3],
                curve: 'smooth'
            },
            fill: {
                type: ['solid', 'gradient'],
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.3
                }
            },
            markers: {
                size: [0, 4]
            },
            tooltip: {
                shared: true,
                intersect: false
            },
            legend: {
                position: 'top'
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        return chart;
    }

    /**
     * Gráfico Comparativo por Localização (Bar Horizontal)
     * Compara a satisfação média entre diferentes localizações
     */
    static createLocationComparison(container, data) {
        const locations = data.map(d => `${d.municipality} (${d.state})`);
        const satisfaction = data.map(d => parseFloat(d.avg_satisfaction)?.toFixed(2) || 0);
        const responses = data.map(d => parseInt(d.total_responses));

        const options = {
            ...BASE_OPTIONS,
            chart: {
                ...BASE_OPTIONS.chart,
                type: 'bar',
                height: Math.max(300, data.length * 40)
            },
            series: [
                {
                    name: 'Média Satisfação',
                    data: satisfaction
                }
            ],
            colors: [CHART_COLORS.primary[0]],
            plotOptions: {
                bar: {
                    horizontal: true,
                    borderRadius: 4,
                    dataLabels: {
                        position: 'top'
                    }
                }
            },
            dataLabels: {
                enabled: true,
                formatter: function(val, opts) {
                    return val + ' / 10';
                },
                offsetX: 30,
                style: {
                    fontSize: '12px',
                    colors: ['#333']
                }
            },
            xaxis: {
                categories: locations,
                max: 10,
                labels: {
                    formatter: function(val) {
                        return val.toFixed(1);
                    }
                }
            },
            yaxis: {
                labels: {
                    maxWidth: 200
                }
            },
            tooltip: {
                custom: function({ series, seriesIndex, dataPointIndex, w }) {
                    const loc = locations[dataPointIndex];
                    const sat = satisfaction[dataPointIndex];
                    const resp = responses[dataPointIndex];
                    return `
                        <div class="apexcharts-tooltip-custom" style="padding: 10px;">
                            <strong>${loc}</strong><br/>
                            Média: ${sat}/10<br/>
                            Respostas: ${resp}
                        </div>
                    `;
                }
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        return chart;
    }

    /**
     * Gráfico de Análise por Pergunta - Escala (Bar Vertical)
     * Mostra a distribuição de respostas para perguntas de escala
     */
    static createScaleQuestionChart(container, data, questionText) {
        const values = data.map(d => parseFloat(d.value));
        const counts = data.map(d => parseInt(d.count));

        const options = {
            ...BASE_OPTIONS,
            chart: {
                ...BASE_OPTIONS.chart,
                type: 'bar',
                height: 300
            },
            series: [{
                name: 'Respostas',
                data: counts
            }],
            colors: CHART_COLORS.primary,
            plotOptions: {
                bar: {
                    distributed: true,
                    borderRadius: 4,
                    columnWidth: '60%'
                }
            },
            xaxis: {
                categories: values.map(v => v.toString()),
                title: { text: 'Nota' }
            },
            yaxis: {
                title: { text: 'Quantidade' }
            },
            title: {
                text: questionText,
                align: 'left',
                style: {
                    fontSize: '14px',
                    fontWeight: 500
                }
            },
            legend: { show: false },
            dataLabels: {
                enabled: true
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        return chart;
    }

    /**
     * Gráfico de Análise por Pergunta - Boolean (Pie)
     * Mostra a distribuição Sim/Não
     */
    static createBooleanQuestionChart(container, data, questionText) {
        const yesCount = data.find(d => d.value === 'true' || d.value === '1' || d.value === 'sim')?.count || 0;
        const noCount = data.find(d => d.value === 'false' || d.value === '0' || d.value === 'nao' || d.value === 'não')?.count || 0;

        const options = {
            ...BASE_OPTIONS,
            chart: {
                ...BASE_OPTIONS.chart,
                type: 'pie',
                height: 300
            },
            series: [parseInt(yesCount), parseInt(noCount)],
            labels: ['Sim', 'Não'],
            colors: [CHART_COLORS.satisfaction.satisfied, CHART_COLORS.satisfaction.veryUnsatisfied],
            title: {
                text: questionText,
                align: 'left',
                style: {
                    fontSize: '14px',
                    fontWeight: 500
                }
            },
            legend: {
                position: 'bottom'
            },
            dataLabels: {
                enabled: true,
                formatter: function(val, opts) {
                    return Math.round(val) + '%';
                }
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        return chart;
    }

    /**
     * Gráfico de Média por Pergunta (Radar)
     * Visão geral de todas as perguntas de escala
     */
    static createQuestionnaireRadar(container, data) {
        const questions = data.filter(d => d.type === 'scale' && d.average);
        const labels = questions.map(d => d.text.length > 30 ? d.text.substring(0, 30) + '...' : d.text);
        const values = questions.map(d => parseFloat(d.average)?.toFixed(2) || 0);

        const options = {
            ...BASE_OPTIONS,
            chart: {
                ...BASE_OPTIONS.chart,
                type: 'radar',
                height: 400
            },
            series: [{
                name: 'Média',
                data: values
            }],
            colors: [CHART_COLORS.primary[0]],
            xaxis: {
                categories: labels
            },
            yaxis: {
                max: 10,
                min: 0
            },
            markers: {
                size: 4
            },
            fill: {
                opacity: 0.3
            },
            stroke: {
                width: 2
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        return chart;
    }

    /**
     * Gráfico de Heatmap - Respostas por Dia/Hora
     * Mostra padrões de quando as respostas são submetidas
     */
    static createResponseHeatmap(container, data) {
        // Processar dados para formato de heatmap
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        const options = {
            ...BASE_OPTIONS,
            chart: {
                ...BASE_OPTIONS.chart,
                type: 'heatmap',
                height: 300
            },
            series: data,
            colors: [CHART_COLORS.primary[0]],
            plotOptions: {
                heatmap: {
                    shadeIntensity: 0.5,
                    colorScale: {
                        ranges: [
                            { from: 0, to: 5, color: '#e0f2fe', name: 'Baixo' },
                            { from: 6, to: 15, color: '#7dd3fc', name: 'Médio' },
                            { from: 16, to: 30, color: '#0ea5e9', name: 'Alto' },
                            { from: 31, to: 100, color: '#0369a1', name: 'Muito Alto' }
                        ]
                    }
                }
            },
            dataLabels: {
                enabled: false
            },
            xaxis: {
                type: 'category'
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        return chart;
    }

    /**
     * Gráfico de Estatísticas Resumidas (Radial Bar)
     * Cards com indicadores principais
     */
    static createStatCard(container, value, max, label, color) {
        const percentage = (value / max) * 100;

        const options = {
            chart: {
                type: 'radialBar',
                height: 150,
                sparkline: { enabled: true }
            },
            series: [percentage],
            colors: [color || CHART_COLORS.primary[0]],
            plotOptions: {
                radialBar: {
                    startAngle: -90,
                    endAngle: 90,
                    hollow: {
                        size: '60%'
                    },
                    track: {
                        background: '#e5e7eb',
                        strokeWidth: '100%'
                    },
                    dataLabels: {
                        name: {
                            show: true,
                            offsetY: 20,
                            color: '#6b7280',
                            fontSize: '12px'
                        },
                        value: {
                            offsetY: -10,
                            fontSize: '24px',
                            fontWeight: 600,
                            color: '#111827',
                            formatter: function() {
                                return value.toFixed(1);
                            }
                        }
                    }
                }
            },
            labels: [label]
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        return chart;
    }

    /**
     * Destrói um gráfico
     */
    static destroy(chart) {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    }
}

// Exportar para uso global
window.ChartFactory = ChartFactory;
window.CHART_COLORS = CHART_COLORS;
